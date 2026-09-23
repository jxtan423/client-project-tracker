import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from '../decorators/public.decorator';
import { AuthPrincipal, TokenService } from '../token.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly tokens: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string }; user?: AuthPrincipal;
    }>();
    const authorization = request.headers.authorization;
    const match = typeof authorization === 'string' && authorization.length <= 4096
      ? /^Bearer ([^\s]+)$/i.exec(authorization) : null;
    if (!match) throw new UnauthorizedException('A valid Bearer token is required.');
    request.user = this.tokens.authenticate(match[1]);
    return true;
  }
}
