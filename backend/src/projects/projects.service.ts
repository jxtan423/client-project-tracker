import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateProjectDto, Project, UpdateProjectDto } from './project.dto';

// A date is returned as text so pg never converts it to a timezone-sensitive JS Date.
const PROJECT_COLUMNS = `id, name, client_name AS "clientName", status,
  to_char(start_date, 'YYYY-MM-DD') AS "startDate",
  created_at AS "createdAt", updated_at AS "updatedAt"`;

@Injectable()
export class ProjectsService {
  constructor(private readonly database: DatabaseService) {}

  async findAll(): Promise<Project[]> {
    const result = await this.database.query<Project>(`SELECT ${PROJECT_COLUMNS} FROM projects ORDER BY id ASC`);
    return result.rows;
  }

  async findOne(id: number): Promise<Project> {
    const result = await this.database.query<Project>(`SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = $1`, [id]);
    if (!result.rows[0]) throw new NotFoundException('Project not found');
    return result.rows[0];
  }

  async create(input: CreateProjectDto): Promise<Project> {
    const result = await this.database.query<Project>(
      `INSERT INTO projects (name, client_name, status, start_date)
       VALUES ($1, $2, $3, $4::date) RETURNING ${PROJECT_COLUMNS}`,
      [input.name, input.clientName, input.status, input.startDate],
    );
    return result.rows[0];
  }

  async update(id: number, input: UpdateProjectDto): Promise<Project> {
    // Column names come only from this fixed mapping, never from request input.
    const columns = { name: 'name', clientName: 'client_name', status: 'status', startDate: 'start_date' } as const;
    const assignments: string[] = [];
    const values: unknown[] = [];
    for (const field of Object.keys(columns) as (keyof UpdateProjectDto)[]) {
      if (input[field] !== undefined) {
        values.push(input[field]);
        assignments.push(`${columns[field]} = $${values.length}`);
      }
    }
    values.push(id);
    const result = await this.database.query<Project>(
      `UPDATE projects SET ${assignments.join(', ')} WHERE id = $${values.length} RETURNING ${PROJECT_COLUMNS}`,
      values,
    );
    if (!result.rows[0]) throw new NotFoundException('Project not found');
    return result.rows[0];
  }

  async remove(id: number): Promise<void> {
    const result = await this.database.query('DELETE FROM projects WHERE id = $1', [id]);
    if (result.rowCount === 0) throw new NotFoundException('Project not found');
  }
}
