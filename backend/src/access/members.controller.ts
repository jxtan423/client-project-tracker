import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ProjectIdPipe } from '../projects/project.dto';
import { AdminGuard } from './guards/admin.guard';
import { MembersService } from './members.service';
import { AddMemberDto, MemberBodyPipe } from './validation/member.dto';

@Controller('projects/:projectId/members')
@UseGuards(AdminGuard)
export class MembersController {
  constructor(private readonly members: MembersService) {}
  @Get() list(@Param('projectId', ProjectIdPipe) projectId: number) { return this.members.list(projectId); }
  @Post() add(@Param('projectId', ProjectIdPipe) projectId: number, @Body(new MemberBodyPipe()) body: AddMemberDto) {
    return this.members.add(projectId, body.userId);
  }
  @Delete(':userId') @HttpCode(204)
  remove(@Param('projectId', ProjectIdPipe) projectId: number, @Param('userId', ProjectIdPipe) userId: number) {
    return this.members.remove(projectId, userId);
  }
}

@Controller('users')
@UseGuards(AdminGuard)
export class UsersController {
  constructor(private readonly members: MembersService) {}
  @Get() list() { return this.members.users(); }
}
