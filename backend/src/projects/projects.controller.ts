import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { CreateProjectDto, ProjectBodyPipe, ProjectIdPipe, UpdateProjectDto } from './project.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  findAll(@CurrentUser() user: CurrentUser) {
    return this.projects.findAll(user);
  }

  @Get(':id')
  findOne(@Param('id', ProjectIdPipe) id: number, @CurrentUser() user: CurrentUser) {
    return this.projects.findOne(id, user);
  }

  @Post()
  create(@Body(new ProjectBodyPipe()) input: CreateProjectDto, @CurrentUser() user: CurrentUser) {
    return this.projects.create(input, user);
  }

  @Patch(':id')
  update(@Param('id', ProjectIdPipe) id: number, @Body(new ProjectBodyPipe(true)) input: UpdateProjectDto, @CurrentUser() user: CurrentUser) {
    return this.projects.update(id, input, user);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ProjectIdPipe) id: number, @CurrentUser() user: CurrentUser) {
    return this.projects.remove(id, user);
  }
}
