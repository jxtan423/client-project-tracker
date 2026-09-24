import { AccessService } from '../access/access.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { CreateProjectDto, Project, UpdateProjectDto } from "./project.dto";

// A date is returned as text so pg never converts it to a timezone-sensitive JS Date.
const PROJECT_COLUMNS = `created_by AS "createdBy", id, name, client_name AS "clientName", status,
  to_char(start_date, 'YYYY-MM-DD') AS "startDate",
  created_at AS "createdAt", updated_at AS "updatedAt", (SELECT count(*)::int FROM tasks WHERE project_id = projects.id) AS "taskCount"`;

@Injectable()
export class ProjectsService {
  constructor(private readonly database: DatabaseService, private readonly access: AccessService) {}

  private permissions(project: Project, user: CurrentUser): Project {
    return { ...project, canDelete: user.role === 'admin' || project.createdBy === user.id };
  }

  async findAll(user: CurrentUser): Promise<Project[]> {
    const result = await this.database.query<Project>(
      `SELECT ${PROJECT_COLUMNS} FROM projects WHERE $2 = 'admin' OR created_by = $1 OR EXISTS (SELECT 1 FROM project_members WHERE project_id = projects.id AND user_id = $1) ORDER BY id ASC`, [user.id, user.role],
    );
    return result.rows.map(project => this.permissions(project, user));
  }

  async findOne(id: number, user: CurrentUser): Promise<Project> {
    await this.access.requireProject(id, user);
    const result = await this.database.query<Project>(
      `SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = $1`,
      [id],
    );
    if (!result.rows[0]) throw new NotFoundException("Project not found");
    return this.permissions(result.rows[0], user);
  }

  async create(input: CreateProjectDto, user: CurrentUser): Promise<Project> {
    const result = await this.database.query<Project>(
      `WITH created AS (
         INSERT INTO projects (name, client_name, status, start_date, created_by)
         VALUES ($1, $2, $3, $4::date, $5) RETURNING *
       ), membership AS (
         INSERT INTO project_members (project_id, user_id) SELECT id, created_by FROM created
       ) SELECT ${PROJECT_COLUMNS} FROM created AS projects`,
      [input.name, input.clientName, input.status, input.startDate, user.id],
    );
    return this.permissions(result.rows[0], user);
  }

  async update(id: number, input: UpdateProjectDto, user: CurrentUser): Promise<Project> {
    await this.access.requireProject(id, user);
    // Column names come only from this fixed mapping, never from request input.
    const columns = {
      name: "name",
      clientName: "client_name",
      status: "status",
      startDate: "start_date",
    } as const;
    const assignments: string[] = [];
    const values: unknown[] = [];
    for (const field of Object.keys(columns) as (keyof UpdateProjectDto)[]) {
      if (input[field] !== undefined) {
        values.push(input[field]);
        assignments.push(`${columns[field]} = $${values.length}`);
      }
    }
    values.push(id);
    // Check completion in the UPDATE itself so a rejected edit changes no fields.
    const completionCondition = input.status === "completed"
      ? " AND NOT EXISTS (SELECT 1 FROM tasks WHERE project_id = projects.id AND status <> 'completed')"
      : "";
    const result = await this.database.query<Project>(
      `UPDATE projects SET ${assignments.join(", ")} WHERE id = $${values.length}${completionCondition} RETURNING ${PROJECT_COLUMNS}`,
      values,
    );
    if (!result.rows[0]) {
      // Preserve 404 for a missing project; an existing project failed the completion rule.
      await this.findOne(id, user);
      throw new ConflictException("Complete all tasks before completing this project.");
    }
    return this.permissions(result.rows[0], user);
  }

  async remove(id: number, user: CurrentUser): Promise<void> {
    await this.access.requireProject(id, user, true);
    const result = await this.database.query(
      "DELETE FROM projects WHERE id = $1",
      [id],
    );
    if (result.rowCount === 0) throw new NotFoundException("Project not found");
  }
}
