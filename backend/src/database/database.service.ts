import { Injectable, InternalServerErrorException, Logger, OnApplicationShutdown, ServiceUnavailableException } from '@nestjs/common';
import { Pool, QueryResult, QueryResultRow } from 'pg';

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

  async query<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []): Promise<QueryResult<T>> {
    try {
      return await this.pool.query<T>(sql, values);
    } catch (error: unknown) {
      // Keep SQL, connection strings and PostgreSQL details out of HTTP responses.
      const code = (error as { code?: string })?.code ?? '';
      this.logger.error('Database operation failed');
      if (code.startsWith('08') || ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE', '57P01', '57P02', '57P03'].includes(code)) {
        throw new ServiceUnavailableException('Database unavailable');
      }
      throw new InternalServerErrorException('Unable to complete database operation');
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
