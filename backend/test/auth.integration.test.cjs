require('reflect-metadata');
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac, randomBytes, randomUUID, scryptSync } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { NestFactory } = require('@nestjs/core');

const originalUrl = process.env.DATABASE_URL;
const originalSecret = process.env.JWT_SECRET;
const signingSecret = randomBytes(32).toString('hex');
process.env.JWT_SECRET = signingSecret;
const { AppModule } = require('../dist/app.module');
const { configureApp } = require('../dist/configure-app');

const database = `tracker_auth_test_${randomUUID().replaceAll('-', '')}`;
const password = '  test-only password with spaces  ';
let admin, db, app, baseUrl, userId, projectId, taskId;

before(async () => {
  const url = new URL(originalUrl ?? 'postgresql://tracker@127.0.0.1:5432/client_project_tracker');
  admin = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 3000 });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${database}"`);
  url.pathname = `/${database}`;
  process.env.DATABASE_URL = url.toString();
  db = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 3000 });
  await db.connect();
  await db.query(readFileSync(path.resolve(__dirname, '../../sql/init.sql'), 'utf8'));
  // Only this disposable test database is cleared; seed behavior is tested separately.
  await db.query('TRUNCATE users RESTART IDENTITY CASCADE');

  // Provision only this disposable database, using the documented hash format.
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
  const hash = `scrypt$v1$131072$8$1$${salt.toString('hex')}$${key.toString('hex')}`;
  userId = (await db.query(
    'INSERT INTO users (name, username, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['Test User', 'Test.User', hash],
  )).rows[0].id;
  await db.query("INSERT INTO users (name, username, password_hash) VALUES ('Legacy Test User', 'legacy-test-user', 'test-only-invalid-hash')");
  projectId = (await db.query("INSERT INTO projects (name, client_name, start_date) VALUES ('Auth fixture', 'Client', '2026-09-22') RETURNING id")).rows[0].id;
  taskId = (await db.query("INSERT INTO tasks (title, project_id) VALUES ('Auth task fixture', $1) RETURNING id", [projectId])).rows[0].id;

  app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
});

after(async () => {
  if (app) await app.close();
  if (db) await db.end();
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
    await admin.end();
  }
  if (originalUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalUrl;
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});

function request(method, route, body, headers = {}) {
  return fetch(`${baseUrl}${route}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function login() {
  const response = await request('POST', '/auth/login', { username: 'Test.User', password });
  assert.equal(response.status, 200, 'the real login endpoint issues the test access token');
  return response.json();
}

function claims(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: String(userId), iat: now - 1, exp: now + 900,
    iss: 'client-project-tracker', aud: 'client-project-tracker-api', ...overrides,
  };
}

// An independent signer can create invalid-claim fixtures that JWT libraries refuse to sign.
function signedToken(payload, secret = signingSecret, algorithm = 'HS256') {
  const header = Buffer.from(JSON.stringify({ alg: algorithm, typ: 'JWT' })).toString('base64url');
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac(algorithm === 'HS512' ? 'sha512' : 'sha256', secret)
    .update(`${header}.${encoded}`).digest('base64url');
  return `${header}.${encoded}.${signature}`;
}

test('public login validates a real scrypt password and returns a safe 15-minute bearer contract', async () => {
  const response = await request('POST', '/auth/login', { username: '  TEST.USER  ', password }, { Authorization: 'Bearer invalid-old-token' });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  const body = await response.json();
  assert.deepEqual(Object.keys(body).sort(), ['accessToken', 'tokenType', 'expiresIn', 'user'].sort());
  assert.equal(body.tokenType, 'Bearer');
  assert.equal(body.expiresIn, 900);
  assert.deepEqual(body.user, { id: userId, name: 'Test User', username: 'Test.User', role: 'user' });
  assert.equal(typeof body.accessToken, 'string');
  assert.doesNotMatch(JSON.stringify(body), /password|scrypt\$|password_hash/);
  const payload = JSON.parse(Buffer.from(body.accessToken.split('.')[1], 'base64url').toString('utf8'));
  assert.equal(payload.sub, String(userId));
  assert.equal(payload.iss, 'client-project-tracker');
  assert.equal(payload.aud, 'client-project-tracker-api');
  assert.equal(payload.exp - payload.iat, 900);
  assert.ok(payload.exp > Date.now() / 1000);
  assert.equal((await request('GET', '/projects', undefined, { Authorization: `Bearer ${body.accessToken}` })).status, 200);
});

test('wrong passwords, unknown users and unsupported stored hashes return the same safe 401', async () => {
  let expected;
  for (const body of [
    { username: 'Test.User', password: 'wrong-password' },
    { username: 'Test.User', password: password.trim() },
    { username: 'no-such-user', password },
    { username: "' OR 1=1 --", password },
    { username: 'legacy-test-user', password },
  ]) {
    const response = await request('POST', '/auth/login', body);
    assert.equal(response.status, 401);
    const failure = await response.json();
    assert.equal(failure.statusCode, 401);
    assert.equal(typeof failure.message, 'string');
    assert.doesNotMatch(JSON.stringify(failure), /password_hash|scrypt\$|SELECT|stack|postgresql:/);
    if (expected) assert.deepEqual(failure, expected, 'invalid credentials must not reveal whether the user exists');
    else expected = failure;
  }
});

test('login rejects missing, null, wrong-type, unknown and oversized input fields with 400', async () => {
  const invalid = [
    {}, [], null, 'credentials',
    { username: 'Test.User' }, { password },
    { username: null, password }, { username: 123, password }, { username: '  ', password },
    { username: 'x'.repeat(101), password }, { username: 'bad\u0000user', password },
    { username: 'Test.User', password: null }, { username: 'Test.User', password: 123 },
    { username: 'Test.User', password: '' }, { username: 'Test.User', password: '😀'.repeat(257) },
    { username: 'Test.User', password, unexpected: true },
  ];
  for (const body of invalid) {
    const response = await request('POST', '/auth/login', body);
    assert.equal(response.status, 400, `invalid login shape: ${JSON.stringify(body).slice(0, 160)}`);
    assert.equal((await response.json()).statusCode, 400);
  }
  const malformed = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"username":',
  });
  assert.equal(malformed.status, 400);
});

test('every project and nested task endpoint rejects missing or forged bearer tokens before reading or writing', async () => {
  const routes = [
    ['GET', '/projects'], ['GET', `/projects/${projectId}`],
    ['POST', '/projects', { name: 'Unauthorized', clientName: 'Client', startDate: '2026-09-22' }],
    ['PATCH', `/projects/${projectId}`, { name: 'Unauthorized' }], ['DELETE', `/projects/${projectId}`],
    ['GET', `/projects/${projectId}/tasks`], ['GET', `/projects/${projectId}/tasks/${taskId}`],
    ['POST', `/projects/${projectId}/tasks`, { title: 'Unauthorized' }],
    ['PATCH', `/projects/${projectId}/tasks/${taskId}`, { title: 'Unauthorized' }],
    ['DELETE', `/projects/${projectId}/tasks/${taskId}`],
  ];
  const forged = signedToken(claims(), randomBytes(32).toString('hex'));
  for (const [method, route, body] of routes) {
    for (const headers of [{}, { Authorization: `Bearer ${forged}` }]) {
      const response = await request(method, route, body, headers);
      assert.equal(response.status, 401, `${method} ${route}`);
      const failure = await response.json();
      assert.equal(failure.statusCode, 401);
      assert.doesNotMatch(JSON.stringify(failure), /JsonWebTokenError|TokenExpiredError|stack|jwt malformed|signature|postgresql:/i);
    }
  }
  assert.deepEqual((await db.query('SELECT name FROM projects')).rows, [{ name: 'Auth fixture' }]);
  assert.deepEqual((await db.query('SELECT title FROM tasks')).rows, [{ title: 'Auth task fixture' }]);
});

test('JWT verification rejects tampering, expiration, missing claims, wrong scope and unexpected algorithms', async () => {
  const valid = signedToken(claims());
  assert.equal((await request('GET', '/projects', undefined, { Authorization: `Bearer ${valid}` })).status, 200,
    'the independently signed control token is valid, so negative fixtures exercise claim checks');
  const [header, , signature] = valid.split('.');
  const tampered = `${header}.${Buffer.from(JSON.stringify(claims({ sub: '2147483647' }))).toString('base64url')}.${signature}`;
  const now = Math.floor(Date.now() / 1000);
  const tokens = [
    ['tampered payload', tampered], ['malformed token', 'not.a.jwt'],
    ['expired token', signedToken(claims({ iat: now - 1000, exp: now - 1 }))],
    ['missing expiry', signedToken(claims({ exp: undefined }))],
    ['string expiry', signedToken(claims({ exp: String(now + 900) }))],
    ['missing issued-at', signedToken(claims({ iat: undefined }))],
    ['wrong issuer', signedToken(claims({ iss: 'another-issuer' }))],
    ['wrong audience', signedToken(claims({ aud: 'another-api' }))],
    ['missing subject', signedToken(claims({ sub: undefined }))],
    ['numeric subject', signedToken(claims({ sub: userId }))],
    ['out-of-range subject', signedToken(claims({ sub: '2147483648' }))],
    ['zero subject', signedToken(claims({ sub: '0' }))],
    ['not yet valid', signedToken(claims({ nbf: now + 120 }))],
    ['unexpected algorithm', signedToken(claims(), signingSecret, 'HS512')],
    ['unsigned token', `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify(claims())).toString('base64url')}.`],
  ];
  for (const [label, token] of tokens) {
    const response = await request('GET', '/projects', undefined, { Authorization: `Bearer ${token}` });
    assert.equal(response.status, 401, label);
  }
  for (const authorization of [`Basic ${valid}`, 'Bearer', `Bearer ${valid} extra`]) {
    assert.equal((await request('GET', '/projects', undefined, { Authorization: authorization })).status, 401);
  }
});

test('a real login token needs membership to read a project and its tasks', async () => {
  const { accessToken } = await login();
  assert.equal((await db.query('SELECT count(*)::int AS count FROM project_members')).rows[0].count, 0);
  assert.equal((await request('GET', `/projects/${projectId}`, undefined, { Authorization: `Bearer ${accessToken}` })).status, 403);
  await db.query('INSERT INTO project_members (project_id, user_id) VALUES ($1, $2)', [projectId, userId]);
  for (const route of ['/projects', `/projects/${projectId}`, `/projects/${projectId}/tasks`, `/projects/${projectId}/tasks/${taskId}`]) {
    assert.equal((await request('GET', route, undefined, { Authorization: `Bearer ${accessToken}` })).status, 200, route);
  }
});

test('health and Angular bearer preflights stay public while protected 401 responses retain CORS headers', async () => {
  assert.equal((await request('GET', '/health')).status, 200);
  for (const origin of ['http://localhost:4200', 'http://127.0.0.1:4200']) {
    const preflight = await request('OPTIONS', `/projects/${projectId}/tasks`, undefined, {
      Origin: origin, 'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type',
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
    assert.match(preflight.headers.get('access-control-allow-headers') ?? '', /authorization/i);
    const denied = await request('GET', '/projects', undefined, { Origin: origin });
    assert.equal(denied.status, 401);
    assert.equal(denied.headers.get('access-control-allow-origin'), origin);
  }
});

test('login database failures return a safe server error instead of invalid-credential details', async () => {
  await db.query('ALTER TABLE users RENAME TO temporarily_unavailable_users');
  try {
    const response = await request('POST', '/auth/login', { username: 'Test.User', password });
    assert.equal(response.status, 500);
    assert.doesNotMatch(JSON.stringify(await response.json()), /SELECT|42P01|relation|postgresql:|stack|temporarily_unavailable/i);
  } finally {
    await db.query('ALTER TABLE temporarily_unavailable_users RENAME TO users');
  }
});
