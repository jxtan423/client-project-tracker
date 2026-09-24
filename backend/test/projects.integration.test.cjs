require('reflect-metadata');
const { before, after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID, scryptSync } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { NestFactory } = require('@nestjs/core');
const originalSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const { AppModule } = require('../dist/app.module');
const { configureApp } = require('../dist/configure-app');

const originalUrl = process.env.DATABASE_URL;
const database = `tracker_projects_test_${randomUUID().replaceAll('-', '')}`;
const loginPassword = 'test-only-project-password';
let admin, db, app, baseUrl, accessToken, loginUserId, passwordHash;

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
  const salt = randomBytes(16);
  const key = scryptSync(loginPassword, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
  passwordHash = `scrypt$v1$131072$8$1$${salt.toString('hex')}$${key.toString('hex')}`;
  app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
});

after(async () => {
  if (app) await app.close();
  if (db) await db.end();
  if (admin) {
    // This identifier is generated internally, never supplied by the environment/user.
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
    await admin.end();
  }
  if (originalUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalUrl;
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});

beforeEach(async () => {
  await db.query('TRUNCATE projects, users RESTART IDENTITY CASCADE');
  loginUserId = (await db.query(
    'INSERT INTO users (name, username, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['Test Member', 'project-test-user', passwordHash],
  )).rows[0].id;
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'project-test-user', password: loginPassword }),
  });
  assert.equal(response.status, 200, 'CRUD fixtures authenticate through the real login endpoint');
  accessToken = (await response.json()).accessToken;
  assert.equal(typeof accessToken, 'string');
});

async function request(method, route = '/projects', body, headers = {}) {
  // Legacy CRUD regressions use fresh versions; concurrency tests bypass this helper.
  if ((method === 'PATCH' || method === 'DELETE') && /^\/projects\/[^/]+(?:\/tasks\/[^/]+)?$/.test(route)) {
    const parts = route.split('/');
    const id = parts.at(-1);
    let version = 1;
    if (/^[1-9]\d*$/.test(id) && Number(id) <= 2147483647) {
      const table = parts.length === 5 ? 'tasks' : 'projects';
      version = (await db.query('SELECT version FROM ' + table + ' WHERE id=$1', [id])).rows[0]?.version ?? 1;
    }
    if (method === 'PATCH') body = { version, ...body };
    else route += '?version=' + version;
  }
  return fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(method === 'OPTIONS' ? {} : { Authorization: `Bearer ${accessToken}` }),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function create(overrides = {}) {
  const response = await request('POST', '/projects', {
    name: 'Website', clientName: 'Client', startDate: '2026-09-21', ...overrides,
  });
  assert.equal(response.status, 201);
  return response.json();
}

test('completion rejects either incomplete task status without partially applying other project fields', async () => {
  const project = await create();
  for (const status of ['todo', 'in_progress']) {
    await db.query('DELETE FROM tasks WHERE project_id = $1', [project.id]);
    await db.query('INSERT INTO tasks (title, project_id, status) VALUES ($1, $2, $3)', ['Remaining work', project.id, status]);
    const before = await (await request('GET', `/projects/${project.id}`)).json();
    const response = await request('PATCH', `/projects/${project.id}`, { status: 'completed', name: 'Should not change' });
    assert.equal(response.status, 409);
    assert.match((await response.json()).message, /complete.*tasks/i);
    assert.deepEqual(await (await request('GET', `/projects/${project.id}`)).json(), before);
  }
});

test('completion succeeds with all tasks completed or no tasks and ignores other projects tasks', async () => {
  const empty = await create();
  const done = await create();
  const other = await create();
  await db.query("INSERT INTO tasks (title, project_id, status) VALUES ('Finished', $1, 'completed'), ('Other work', $2, 'todo')", [done.id, other.id]);
  for (const project of [empty, done]) {
    const response = await request('PATCH', `/projects/${project.id}`, { status: 'completed' });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'completed');
  }
  assert.equal((await request('PATCH', '/projects/2147483647', { status: 'completed' })).status, 404);
});

test('incomplete tasks do not block ordinary project edits or reopening a project', async () => {
  const project = await create({ status: 'completed' });
  await db.query("INSERT INTO tasks (title, project_id) VALUES ('Reopened work', $1)", [project.id]);
  assert.equal((await request('PATCH', `/projects/${project.id}`, { name: 'Updated name' })).status, 200);
  const response = await request('PATCH', `/projects/${project.id}`, { status: 'in_progress' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'in_progress');
});

test('project create persists trimmed fields, defaults status and preserves a calendar date', async () => {
  const project = await create({ name: '  Website  ', clientName: ' Client ', startDate: '2024-02-29' });
  assert.deepEqual(Object.keys(project).sort(), ['id', 'name', 'clientName', 'status', 'startDate', 'createdAt', 'updatedAt', 'taskCount', 'createdBy', 'canDelete', 'version'].sort());
  assert.equal(project.id, 1);
  assert.equal(project.name, 'Website');
  assert.equal(project.clientName, 'Client');
  assert.equal(project.status, 'planned');
  assert.equal(project.startDate, '2024-02-29');
  assert.ok(Number.isFinite(Date.parse(project.createdAt)));
  assert.ok(Number.isFinite(Date.parse(project.updatedAt)));
  const stored = (await db.query('SELECT name, client_name, start_date::text FROM projects WHERE id = $1', [project.id])).rows[0];
  assert.deepEqual(stored, { name: 'Website', client_name: 'Client', start_date: '2024-02-29' });
});

test('project list returns empty array then stable ascending IDs and detail returns the same representation', async () => {
  const empty = await request('GET');
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), []);
  const first = await create({ name: 'Zebra' });
  const second = await create({ name: 'Alpha', status: 'in_progress' });
  const list = await request('GET');
  assert.equal(list.status, 200);
  assert.deepEqual((await list.json()).map(project => project.id), [first.id, second.id]);
  const detail = await request('GET', `/projects/${second.id}`);
  assert.equal(detail.status, 200);
  assert.deepEqual(await detail.json(), second);
});

test('project patch changes supplied fields while preserving omitted fields and advances updatedAt', async () => {
  const project = await create();
  const response = await request('PATCH', `/projects/${project.id}`, { name: ' Revised ', status: 'completed' });
  assert.equal(response.status, 200);
  const updated = await response.json();
  assert.equal(updated.name, 'Revised');
  assert.equal(updated.status, 'completed');
  assert.equal(updated.clientName, 'Client');
  assert.equal(updated.startDate, '2026-09-21');
  assert.equal(updated.createdAt, project.createdAt);
  assert.ok(Date.parse(updated.updatedAt) > Date.parse(project.updatedAt));
  assert.equal((await (await request('GET', `/projects/${project.id}`)).json()).name, 'Revised');
});

test('project delete returns no content and cascades related tasks/memberships without deleting the user', async () => {
  const project = await create();
  const userId = loginUserId;
  assert.equal((await db.query('SELECT user_id FROM project_members WHERE project_id = $1', [project.id])).rows[0].user_id, userId);
  await db.query("INSERT INTO tasks (title, project_id, assignee_id) VALUES ('Task', $1, $2)", [project.id, userId]);
  const response = await request('DELETE', `/projects/${project.id}`);
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  assert.equal((await request('GET', `/projects/${project.id}`)).status, 404);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM tasks')).rows[0].count, 0);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM project_members')).rows[0].count, 0);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM users')).rows[0].count, 1);
});

test('project input validation exposes field errors and rejects invalid writes without persisting them', async () => {
  const invalidBodies = [
    [{}, ['name', 'clientName', 'startDate']],
    [{ name: '  ', clientName: 123, startDate: '2023-02-29', status: 'other' }, ['name', 'clientName', 'startDate', 'status']],
    [{ name: 'x'.repeat(201), clientName: 'Client', startDate: '2026-04-31' }, ['name', 'startDate']],
    [{ name: 'Name', clientName: 'x'.repeat(201), startDate: '2026-9-21' }, ['clientName', 'startDate']],
    [{ name: 'Name', clientName: 'Client', startDate: '2026-09-21T00:00:00Z', unexpected: true }, ['startDate', 'unexpected']],
    [{ name: 'Name', clientName: 'Client', startDate: '0000-01-01', status: null }, ['startDate', 'status']],
    [[], ['body']],
  ];
  for (const [body, fields] of invalidBodies) {
    const response = await request('POST', '/projects', body);
    assert.equal(response.status, 400, JSON.stringify(body));
    const error = await response.json();
    assert.equal(error.statusCode, 400);
    assert.equal(typeof error.message, 'string');
    for (const field of fields) assert.ok(error.errors[field]?.length, `${field}: ${JSON.stringify(error)}`);
  }
  assert.equal((await db.query('SELECT count(*)::int AS count FROM projects')).rows[0].count, 0);
});

test('project patch rejects null, unknown and empty payloads without changing existing data', async () => {
  const project = await create();
  for (const body of [{}, { name: null }, { clientName: null }, { startDate: null }, { status: null }, { id: 20 }, { startDate: '2026-02-30' }]) {
    const response = await request('PATCH', `/projects/${project.id}`, body);
    assert.equal(response.status, 400);
    assert.ok(Object.keys((await response.json()).errors).length);
  }
  assert.deepEqual(await (await request('GET', `/projects/${project.id}`)).json(), project);
});

test('project IDs reject malformed and out-of-range values and valid nonexistent IDs return 404', async () => {
  for (const method of ['GET', 'PATCH', 'DELETE']) {
    for (const id of ['0', '-1', '1.5', 'abc', '2147483648', '1e2', '1abc']) {
      const response = await request(method, `/projects/${id}`, method === 'PATCH' ? { name: 'Updated' } : undefined);
      assert.equal(response.status, 400, `${method} ${id}`);
      assert.ok((await response.json()).errors.id.length);
    }
    assert.equal((await request(method, '/projects/2147483647', method === 'PATCH' ? { name: 'Updated' } : undefined)).status, 404);
  }
});

test('project names containing SQL syntax are stored as literal text', async () => {
  const name = "O'Reilly'); DROP TABLE projects; --";
  const project = await create({ name });
  assert.equal(project.name, name);
  assert.equal((await (await request('GET')).json()).length, 1);
});

test('local Angular origins can preflight JSON PATCH requests while unconfigured origins cannot read responses', async () => {
  for (const origin of ['http://localhost:4200', 'http://127.0.0.1:4200']) {
    const response = await request('OPTIONS', '/projects/1', undefined, {
      Origin: origin,
      'Access-Control-Request-Method': 'PATCH',
      'Access-Control-Request-Headers': 'content-type,authorization',
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.ok(response.headers.get('access-control-allow-methods').includes('PATCH'));
    assert.ok(response.headers.get('access-control-allow-headers').toLowerCase().includes('content-type'));
    assert.ok(response.headers.get('access-control-allow-headers').toLowerCase().includes('authorization'));
  }
  const denied = await request('GET', '/projects', undefined, { Origin: 'https://unconfigured.example' });
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});

test('unexpected database errors return a safe message without SQL or PostgreSQL details', async () => {
  await db.query('ALTER TABLE projects RENAME TO temporarily_unavailable_projects');
  try {
    const response = await request('GET');
    assert.equal(response.status, 500);
    const body = await response.json();
    assert.equal(typeof body.message, 'string');
    assert.doesNotMatch(JSON.stringify(body), /SELECT|relation|42P01|postgresql:|stack|temporarily_unavailable/i);
  } finally {
    await db.query('ALTER TABLE temporarily_unavailable_projects RENAME TO projects');
  }
});

test('unreachable PostgreSQL returns 503 for project requests without exposing connection details', async () => {
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgresql://tracker@127.0.0.1:1/unavailable';
  let unavailableApp;
  try {
    unavailableApp = await NestFactory.create(AppModule, { logger: false });
    configureApp(unavailableApp);
    await unavailableApp.listen(0, '127.0.0.1');
    const response = await fetch(`${await unavailableApp.getUrl()}/projects`, { headers: { Authorization: `Bearer ${accessToken}` } });
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.message, 'Database unavailable');
    assert.doesNotMatch(JSON.stringify(body), /postgresql:|ECONNREFUSED|127\.0\.0\.1|stack/);
  } finally {
    if (unavailableApp) await unavailableApp.close();
    process.env.DATABASE_URL = previousUrl;
  }
});

test('project text fields reject null bytes as field errors rather than database errors', async () => {
  const response = await request('POST', '/projects', { name: 'Bad\u0000name', clientName: 'Bad\u0000client', startDate: '2026-09-21' });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.ok(body.errors.name.length);
  assert.ok(body.errors.clientName.length);
});

test('task CRUD isolates projects and updates counts', async () => {
 const a=await create(), b=await create(), route=`/projects/${a.id}/tasks`;
 const r=await request('POST',route,{title:' Worksheet ',dueDate:'2024-02-29'}); assert.equal(r.status,201);
 const t=await r.json(); assert.equal(t.title,'Worksheet'); assert.equal(t.assigneeId,null);
 assert.equal((await (await request('GET',route)).json()).length,1);
 assert.equal((await (await request('GET',`/projects/${a.id}`)).json()).taskCount,1);
 for(const method of ['GET','PATCH','DELETE']) assert.equal((await request(method,`/projects/${b.id}/tasks/${t.id}`,method==='PATCH'?{title:'Wrong'}:undefined)).status,404);
 for(const body of [{title:''},{title:'x',dueDate:'2026-02-29'},{title:'x',assigneeId:1},{title:'x',status:'planned'}]) assert.equal((await request('POST',route,body)).status,400);
 const u=await request('PATCH',`${route}/${t.id}`,{status:'completed',dueDate:null}); assert.equal(u.status,200); assert.equal((await u.json()).dueDate,null);
 assert.equal((await request('DELETE',`${route}/${t.id}`)).status,204);
 assert.equal((await (await request('GET',`/projects/${a.id}`)).json()).taskCount,0);
 assert.equal((await request('GET','/projects/2147483647/tasks')).status,404);
});


// Raw requests intentionally never infer or refresh a version.
function versionRequest(method, route, body) {
  return fetch(baseUrl + route, {
    method, headers: { Authorization: 'Bearer ' + accessToken, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

for (const kind of ['project', 'task']) {
  async function fixture() {
    const project = await create();
    if (kind === 'project') return { record: project, route: '/projects/' + project.id, collection: '/projects', field: 'name', createBody: { name: 'New', clientName: 'Client', startDate: '2026-09-24' }, table: 'projects' };
    const collection = '/projects/' + project.id + '/tasks';
    const response = await versionRequest('POST', collection, { title: 'Original' });
    assert.equal(response.status, 201);
    const record = await response.json();
    return { record, route: collection + '/' + record.id, collection, field: 'title', createBody: { title: 'New' }, table: 'tasks' };
  }

  test(kind + ' validates explicit mutation versions and rejects versions on create', async () => {
    const f = await fixture();
    assert.equal(f.record.version, 1);
    for (const version of [undefined, null, 0, -1, 1.5, '1', 2147483648, true]) {
      const response = await versionRequest('PATCH', f.route, { [f.field]: 'Changed', ...(version === undefined ? {} : { version }) });
      assert.equal(response.status, 400, 'Invalid PATCH version: ' + String(version));
    }
    assert.equal((await versionRequest('PATCH', f.route, { version: 1 })).status, 400, 'version alone is not an edit');
    for (const query of ['', '?version=0', '?version=-1', '?version=1.5', '?version=abc', '?version=2147483648', '?version=1e0', '?version=1&version=2']) {
      assert.equal((await versionRequest('DELETE', f.route + query)).status, 400, query);
    }
    assert.equal((await versionRequest('POST', f.collection, { ...f.createBody, version: 1 })).status, 400);
    assert.deepEqual(await (await versionRequest('GET', f.route)).json(), f.record, 'invalid writes leave record unchanged');
  });

  test(kind + ' simultaneous edits have one winner and stale completion/deletion cannot overwrite it', async () => {
    const f = await fixture();
    const candidates = [
      { [f.field]: 'First editor', status: 'in_progress', version: 1 },
      { [f.field]: 'Second editor', status: 'completed', version: 1 },
    ];
    const results = await Promise.all(candidates.map(body => versionRequest('PATCH', f.route, body)));
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    const winnerIndex = results.findIndex(r => r.status === 200);
    const winner = await results[winnerIndex].json();
    assert.equal(winner.version, 2);
    assert.equal(winner[f.field], candidates[winnerIndex][f.field]);
    assert.equal(winner.status, candidates[winnerIndex].status);
    assert.equal((await results[1 - winnerIndex].json()).code, 'VERSION_CONFLICT');
    for (const [method, route, body] of [
      ['PATCH', f.route, { status: 'completed', version: 1 }],
      ['DELETE', f.route + '?version=1'],
    ]) {
      const response = await versionRequest(method, route, body);
      assert.equal(response.status, 409);
      assert.equal((await response.json()).code, 'VERSION_CONFLICT');
    }
    const reread = await (await versionRequest('GET', f.route)).json();
    assert.deepEqual(reread, winner, 'no mixed or partial updates');
    const retry = await versionRequest('PATCH', f.route, { [f.field]: 'Reviewed newer data', version: reread.version });
    assert.equal(retry.status, 200);
    const latest = await retry.json();
    assert.equal(latest.version, 3);
    assert.equal((await versionRequest('DELETE', f.route + '?version=' + latest.version)).status, 204);
    assert.equal((await versionRequest('PATCH', f.route, { [f.field]: 'Deleted', version: latest.version })).status, 404);
    assert.equal((await versionRequest('DELETE', f.route + '?version=' + latest.version)).status, 404);
  });

  test(kind + ' direct SQL updates also invalidate a loaded version', async () => {
    const f = await fixture();
    const column = kind === 'project' ? 'name' : 'title';
    await db.query('UPDATE ' + f.table + ' SET ' + column + '=$1 WHERE id=$2', ['Changed in database', f.record.id]);
    const current = await (await versionRequest('GET', f.route)).json();
    assert.equal(current.version, 2);
    const stale = await versionRequest('PATCH', f.route, { [f.field]: 'Outdated browser', version: 1 });
    assert.equal(stale.status, 409);
    assert.equal((await stale.json()).code, 'VERSION_CONFLICT');
    assert.deepEqual(await (await versionRequest('GET', f.route)).json(), current);
  });
}
