import { INestApplication } from '@nestjs/common';

/** Used by both the server entrypoint and HTTP integration tests. */
export function configureApp(app: INestApplication): void {
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:4200,http://127.0.0.1:4200')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
}
