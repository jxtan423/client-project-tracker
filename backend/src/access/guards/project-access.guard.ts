import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ProjectIdPipe } from '../../projects/project.dto';
import { AccessService } from '../access.service';

@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(private readonly access: AccessService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ params: { projectId: string }; user: CurrentUser }>();
    // Guards run before parameter pipes; validate the parent ID before querying PostgreSQL.
    const id = new ProjectIdPipe().transform(request.params.projectId);
    await this.access.requireProject(id, request.user);
    return true;
  }
}
