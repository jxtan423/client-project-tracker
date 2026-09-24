import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Injectable()
export class AccessService {
  constructor(private readonly database: DatabaseService) {}

  async requireProject(projectId: number, user: CurrentUser, deleting = false): Promise<void> {
    const project = (await this.database.query<{ createdBy: number | null; member: boolean }>(
      `SELECT created_by AS "createdBy", EXISTS(SELECT 1 FROM project_members WHERE project_id=projects.id AND user_id=$2) AS member
       FROM projects WHERE id=$1`, [projectId, user.id],
    )).rows[0];
    if (!project) throw new NotFoundException('Project not found');
    if (user.role === 'admin' || project.createdBy === user.id) return;
    if (!deleting && project.member) return;
    throw new ForbiddenException(deleting ? 'Only the creator or an administrator can delete this project.' : 'You are not a member of this project.');
  }
}
