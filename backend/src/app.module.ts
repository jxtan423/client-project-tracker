import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { ProjectsModule } from './projects/projects.module';

@Module({ imports: [DatabaseModule, ProjectsModule], controllers: [HealthController] })
export class AppModule {}
