import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from '../decorators/public.decorator';
import { TokenService } from '../token.service';
import { DatabaseService } from '../../database/database.service';
import { CurrentUser } from '../decorators/current-user.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly tokens: TokenService, private readonly database: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string }; user?: CurrentUser;
    }>();
    const authorization = request.headers.authorization;
    const match = typeof authorization === 'string' && authorization.length <= 4096
      ? /^Bearer ([^\s]+)$/i.exec(authorization) : null;
    if (!match) throw new UnauthorizedException('A valid Bearer token is required.');
    const principal = this.tokens.authenticate(match[1]);
    const user = (await this.database.query<CurrentUser>('SELECT id, role FROM users WHERE id=$1', [principal.id])).rows[0];
    if (!user) throw new UnauthorizedException('This account is no longer available.');
    request.user = user;
    return true;
  }
}
