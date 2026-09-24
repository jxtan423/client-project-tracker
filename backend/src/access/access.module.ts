import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AccessService } from './access.service';
import { AdminGuard } from './guards/admin.guard';
import { ProjectAccessGuard } from './guards/project-access.guard';
import { MembersController, UsersController } from './members.controller';
import { MembersService } from './members.service';

@Module({ imports: [DatabaseModule], controllers: [MembersController, UsersController],
  providers: [AccessService, AdminGuard, ProjectAccessGuard, MembersService],
  exports: [AccessService, ProjectAccessGuard] })
export class AccessModule {}
