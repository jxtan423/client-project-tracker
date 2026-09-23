import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from './database/database.service';
import { Public } from './auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  @Public()
  async health() {
    try {
      await this.database.checkConnection();
      return { status: 'ok', database: 'connected' };
    } catch {
      throw new ServiceUnavailableException('Database unavailable');
    }
  }
}
