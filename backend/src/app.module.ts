import { TasksModule } from "./tasks/tasks.module";
import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health.controller";
import { ProjectsModule } from "./projects/projects.module";
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [DatabaseModule, ProjectsModule, TasksModule, AuthModule],
  controllers: [HealthController],
})
export class AppModule {}
