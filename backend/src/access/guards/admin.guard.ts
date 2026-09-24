import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.switchToHttp().getRequest<{ user: CurrentUser }>().user.role !== 'admin') {
      throw new ForbiddenException('Administrator access is required.');
    }
    return true;
  }
}
