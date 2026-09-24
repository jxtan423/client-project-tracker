import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class MembersService {
  constructor(private readonly database: DatabaseService) {}
  private async project(id: number) {
    const row = (await this.database.query('SELECT created_by FROM projects WHERE id=$1', [id])).rows[0];
    if (!row) throw new NotFoundException('Project not found');
    return row;
  }
  async users() {
    return (await this.database.query('SELECT id, name, username, role FROM users ORDER BY id')).rows;
  }
  async list(projectId: number) {
    await this.project(projectId);
    return (await this.database.query(`SELECT u.id,u.name,u.username,u.role FROM users u
      JOIN project_members m ON m.user_id=u.id WHERE m.project_id=$1 ORDER BY u.id`, [projectId])).rows;
  }
  async add(projectId: number, userId: number) {
    await this.project(projectId);
    const user = (await this.database.query('SELECT id,name,username,role FROM users WHERE id=$1', [userId])).rows[0];
    if (!user) throw new NotFoundException('User not found');
    await this.database.query('INSERT INTO project_members(project_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [projectId, userId]);
    return user;
  }
  async remove(projectId: number, userId: number) {
    const project = await this.project(projectId);
    if (project.created_by === userId) throw new ConflictException('The project creator cannot be removed.');
    const result = await this.database.query(`DELETE FROM project_members WHERE project_id=$1 AND user_id=$2
      AND NOT EXISTS(SELECT 1 FROM tasks WHERE project_id=$1 AND assignee_id=$2)`, [projectId, userId]);
    if (result.rowCount) return;
    const membership = await this.database.query('SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2', [projectId, userId]);
    if (!membership.rowCount) throw new NotFoundException('Project member not found');
    throw new ConflictException('Reassign or unassign this member’s tasks before removing them.');
  }
}
