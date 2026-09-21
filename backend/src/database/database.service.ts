import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL ??
      'postgresql://tracker@127.0.0.1:5432/client_project_tracker',
    connectionTimeoutMillis: 3000,
    query_timeout: 3000,
    max: 10,
  });

  constructor() {
    // Idle clients can emit errors when the database restarts.
    this.pool.on('error', () => this.logger.error('An idle database connection failed'));
  }

  async checkConnection(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
