import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ProjectIdPipe } from "../projects/project.dto";
import { TaskBodyPipe, TaskInput } from "./task.dto";
import { TasksService } from "./tasks.service";
@Controller("projects/:projectId/tasks")
export class TasksController {
  constructor(private readonly tasks: TasksService) {}
  @Get() list(@Param("projectId", ProjectIdPipe) p: number) {
    return this.tasks.list(p);
  }
  @Get(":taskId") get(
    @Param("projectId", ProjectIdPipe) p: number,
    @Param("taskId", ProjectIdPipe) id: number,
  ) {
    return this.tasks.get(p, id);
  }
  @Post() create(
    @Param("projectId", ProjectIdPipe) p: number,
    @Body(new TaskBodyPipe()) body: TaskInput,
  ) {
    return this.tasks.create(p, body);
  }
  @Patch(":taskId") update(
    @Param("projectId", ProjectIdPipe) p: number,
    @Param("taskId", ProjectIdPipe) id: number,
    @Body(new TaskBodyPipe(true)) body: Partial<TaskInput>,
  ) {
    return this.tasks.update(p, id, body);
  }
  @Delete(":taskId") @HttpCode(204) remove(
    @Param("projectId", ProjectIdPipe) p: number,
    @Param("taskId", ProjectIdPipe) id: number,
  ) {
    return this.tasks.remove(p, id);
  }
}
