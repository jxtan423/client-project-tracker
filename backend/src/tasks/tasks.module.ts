import { AccessModule } from '../access/access.module';
import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";
@Module({
  imports: [DatabaseModule, AccessModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
