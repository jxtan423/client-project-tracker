import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { CreateProjectDto, ProjectBodyPipe, ProjectIdPipe, UpdateProjectDto } from './project.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  findAll() {
    return this.projects.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ProjectIdPipe) id: number) {
    return this.projects.findOne(id);
  }

  @Post()
  create(@Body(new ProjectBodyPipe()) input: CreateProjectDto) {
    return this.projects.create(input);
  }

  @Patch(':id')
  update(@Param('id', ProjectIdPipe) id: number, @Body(new ProjectBodyPipe(true)) input: UpdateProjectDto) {
    return this.projects.update(id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ProjectIdPipe) id: number) {
    return this.projects.remove(id);
  }
}
