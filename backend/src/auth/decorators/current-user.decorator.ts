import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUser { id: number; role: 'admin' | 'user' }

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): CurrentUser =>
  context.switchToHttp().getRequest<{ user: CurrentUser }>().user,
);
