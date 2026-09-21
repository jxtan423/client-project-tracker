require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');

test('health confirms a query against the real PostgreSQL database', async () => {
  const app = await NestFactory.create(AppModule, { logger: false });
  try {
    await app.listen(0, '127.0.0.1');
    const response = await fetch(`${await app.getUrl()}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', database: 'connected' });
  } finally {
    await app.close();
  }
});

test('health returns 503 without leaking connection details when PostgreSQL is unavailable', async () => {
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgresql://tracker@127.0.0.1:1/client_project_tracker';
  let app;
  try {
    app = await NestFactory.create(AppModule, { logger: false });
    await app.listen(0, '127.0.0.1');
    const response = await fetch(`${await app.getUrl()}/health`);
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.message, 'Database unavailable');
    assert.equal(JSON.stringify(body).includes('postgresql://'), false);
  } finally {
    if (app) await app.close();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  }
});
