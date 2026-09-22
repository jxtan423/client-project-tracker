import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { TaskInput } from "./task.dto";
const COLUMNS = `id, project_id AS "projectId", title, status, assignee_id AS "assigneeId", to_char(due_date, 'YYYY-MM-DD') AS "dueDate", version, created_at AS "createdAt", updated_at AS "updatedAt"`;
@Injectable()
export class TasksService {
  constructor(private readonly db: DatabaseService) {}
  async list(projectId: number) {
    if (
      !(await this.db.query("SELECT id FROM projects WHERE id=$1", [projectId]))
        .rowCount
    )
      throw new NotFoundException("Project not found");
    return (
      await this.db.query(
        `SELECT ${COLUMNS} FROM tasks WHERE project_id=$1 ORDER BY id`,
        [projectId],
      )
    ).rows;
  }
  async get(projectId: number, id: number) {
    const row = (
      await this.db.query(
        `SELECT ${COLUMNS} FROM tasks WHERE project_id=$1 AND id=$2`,
        [projectId, id],
      )
    ).rows[0];
    if (!row) throw new NotFoundException("Task not found in this project");
    return row;
  }
  async create(projectId: number, input: TaskInput) {
    const row = (
      await this.db.query(
        `INSERT INTO tasks (project_id,title,status,due_date) SELECT id,$2,$3,$4::date FROM projects WHERE id=$1 RETURNING ${COLUMNS}`,
        [projectId, input.title, input.status, input.dueDate],
      )
    ).rows[0];
    if (!row) throw new NotFoundException("Project not found");
    return row;
  }
  async update(projectId: number, id: number, input: Partial<TaskInput>) {
    const columns = { title: "title", status: "status", dueDate: "due_date" };
    const values: unknown[] = [projectId, id];
    const assignments: string[] = [];
    for (const field of Object.keys(columns) as (keyof TaskInput)[])
      if (Object.hasOwn(input, field)) {
        values.push(input[field]);
        assignments.push(`${columns[field]}=$${values.length}`);
      }
    const row = (
      await this.db.query(
        `UPDATE tasks SET ${assignments.join(", ")} WHERE project_id=$1 AND id=$2 RETURNING ${COLUMNS}`,
        values,
      )
    ).rows[0];
    if (!row) throw new NotFoundException("Task not found in this project");
    return row;
  }
  async remove(projectId: number, id: number) {
    if (
      !(
        await this.db.query("DELETE FROM tasks WHERE project_id=$1 AND id=$2", [
          projectId,
          id,
        ])
      ).rowCount
    )
      throw new NotFoundException("Task not found in this project");
  }
}
