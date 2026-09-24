import { ConflictException } from '@nestjs/common';

export function versionConflict(record: 'Project' | 'Task'): never {
  throw new ConflictException({
    statusCode: 409,
    code: 'VERSION_CONFLICT',
    message: `${record} changed since you opened it. Close this dialog and reopen the latest record before trying again.`,
  });
}
