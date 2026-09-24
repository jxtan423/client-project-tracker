require('reflect-metadata');
const { after, test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { NestFactory } = require('@nestjs/core');
const originalSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const { AppModule } = require('../dist/app.module');

after(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});

test('public health confirms a database query without requiring a bearer token', async () => {
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
