require('reflect-metadata');
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const { NestFactory } = require('@nestjs/core');
const originalUrl = process.env.DATABASE_URL;
const originalSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const { AppModule } = require('../dist/app.module');
const { configureApp } = require('../dist/configure-app');
const database = `tracker_access_test_${randomUUID().replaceAll('-', '')}`;
let admin, db, app, baseUrl, owner, member, outsider, manager, project, task;
const tokens = {};
before(async () => {
  const url = new URL(originalUrl ?? 'postgresql://tracker@127.0.0.1:5432/client_project_tracker');
  admin = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 3000 });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${database}"`);
  url.pathname = `/${database}`;
  process.env.DATABASE_URL = url.toString();
  db = new Client({ connectionString: url.toString() });
  await db.connect();
  await db.query(readFileSync(path.resolve(__dirname, '../../sql/init.sql'), 'utf8'));
  // Use isolated fixture accounts in this disposable database.
  await db.query('TRUNCATE users RESTART IDENTITY CASCADE');
  const ids = [];
  for (const [name, role] of [['owner', 'user'], ['member', 'user'], ['outsider', 'user'], ['manager', 'admin']]) {
    const id = (await db.query('INSERT INTO users(name,username,password_hash,role) VALUES ($1,$1,$2,$3) RETURNING id', [name, 'test-only-hash', role])).rows[0].id;
    ids.push(id);
    tokens[id] = jwt.sign({}, process.env.JWT_SECRET, { algorithm: 'HS256', subject: String(id), issuer: 'client-project-tracker', audience: 'client-project-tracker-api', expiresIn: 900 });
  }
  [owner, member, outsider, manager] = ids;
  app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
});
after(async () => {
  if (app) await app.close();
  if (db) await db.end();
  if (admin) { await admin.query(`DROP DATABASE IF EXISTS "${database}"`); await admin.end(); }
  if (originalUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = originalUrl;
  if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
});
async function request(user, method, route, body) {
  // Authorization regressions supply fresh versions, including forbidden requests.
  if ((method === 'PATCH' || method === 'DELETE') && /^\/projects\/\d+(?:\/tasks\/\d+)?$/.test(route)) {
    const parts = route.split('/');
    const table = parts.length === 5 ? 'tasks' : 'projects';
    const version = (await db.query('SELECT version FROM ' + table + ' WHERE id=$1', [parts.at(-1)])).rows[0]?.version ?? 1;
    if (method === 'PATCH') body = { version, ...body };
    else route += '?version=' + version;
  }
  return fetch(`${baseUrl}${route}`, { method, headers: { Authorization: `Bearer ${tokens[user]}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

test('project creation records the authenticated creator and initial membership and filters lists', async () => {
  const response = await request(owner, 'POST', '/projects', { name: 'Private', clientName: 'Client', startDate: '2026-09-23' });
  assert.equal(response.status, 201);
  project = await response.json();
  assert.equal(project.createdBy, owner);
  assert.equal(project.canDelete, true);
  assert.deepEqual((await db.query('SELECT user_id FROM project_members WHERE project_id=$1', [project.id])).rows, [{ user_id: owner }]);
  assert.deepEqual(await (await request(outsider, 'GET', '/projects')).json(), []);
  assert.equal((await (await request(manager, 'GET', '/projects')).json()).length, 1);
});

test('nonmembers are denied every project and nested task action; members can edit but not delete projects', async () => {
  await db.query('INSERT INTO project_members VALUES ($1,$2)', [project.id, member]);
  const created = await request(member, 'POST', `/projects/${project.id}/tasks`, { title: 'Work' });
  assert.equal(created.status, 201);
  task = await created.json();
  for (const [method, suffix, body] of [
    ['GET', ''], ['PATCH', '', { name: 'Forbidden' }], ['DELETE', ''], ['GET', '/tasks'],
    ['GET', `/tasks/${task.id}`], ['POST', '/tasks', { title: 'Forbidden' }],
    ['PATCH', `/tasks/${task.id}`, { title: 'Forbidden' }], ['DELETE', `/tasks/${task.id}`],
  ]) assert.equal((await request(outsider, method, `/projects/${project.id}${suffix}`, body)).status, 403, `${method} ${suffix}`);
  assert.equal((await request(member, 'PATCH', `/projects/${project.id}`, { name: 'Member edit' })).status, 200);
  assert.equal((await request(member, 'PATCH', `/projects/${project.id}/tasks/${task.id}`, { status: 'completed' })).status, 200);
  assert.equal((await request(member, 'PATCH', `/projects/${project.id}`, { status: 'completed' })).status, 200);
  assert.equal((await request(member, 'DELETE', `/projects/${project.id}`)).status, 403);
  const list = await (await request(member, 'GET', '/projects')).json();
  assert.equal(list[0].canDelete, false);
  assert.equal(list[0].taskCount, 1);
  assert.equal((await request(outsider, 'GET', '/projects/2147483647/tasks')).status, 404);
  assert.equal((await request(member, 'GET', `/projects/${project.id}/tasks/2147483647`)).status, 404);
});

test('only admins manage safe directory and memberships; protect creators and assigned members', async () => {
  for (const user of [owner, member]) {
    for (const [method, route, body] of [['GET', '/users'], ['GET', `/projects/${project.id}/members`], ['POST', `/projects/${project.id}/members`, { userId: outsider }], ['DELETE', `/projects/${project.id}/members/${member}`]]) {
      assert.equal((await request(user, method, route, body)).status, 403);
    }
  }
  const directory = await (await request(manager, 'GET', '/users')).json();
  assert.equal(directory.length, 4);
  assert.deepEqual(Object.keys(directory[0]).sort(), ['id', 'name', 'role', 'username']);
  const added = await request(manager, 'POST', `/projects/${project.id}/members`, { userId: outsider });
  assert.equal(added.status, 201);
  assert.equal((await added.json()).id, outsider);
  assert.equal((await request(manager, 'POST', `/projects/${project.id}/members`, { userId: outsider })).status, 201);
  assert.equal((await request(outsider, 'GET', `/projects/${project.id}`)).status, 200);
  assert.equal((await request(manager, 'DELETE', `/projects/${project.id}/members/${owner}`)).status, 409);
  await db.query('UPDATE tasks SET assignee_id=$1 WHERE id=$2', [member, task.id]);
  assert.equal((await request(manager, 'DELETE', `/projects/${project.id}/members/${member}`)).status, 409);
  const removed = await request(manager, 'DELETE', `/projects/${project.id}/members/${outsider}`);
  assert.equal(removed.status, 204);
  assert.equal((await request(outsider, 'GET', `/projects/${project.id}`)).status, 403, 'same JWT loses access immediately');
  assert.equal((await request(manager, 'POST', `/projects/${project.id}/members`, { userId: 2147483647 })).status, 404);
  assert.equal((await request(manager, 'POST', `/projects/${project.id}/members`, { userId: outsider, role: 'admin' })).status, 400);
});

test('database role changes take effect with the same JWT; deleted accounts are rejected', async () => {
  assert.equal((await request(outsider, 'GET', '/users')).status, 403);
  await db.query("UPDATE users SET role='admin' WHERE id=$1", [outsider]);
  assert.equal((await request(outsider, 'GET', '/users')).status, 200);
  assert.equal((await request(outsider, 'GET', `/projects/${project.id}`)).status, 200);
  await db.query("UPDATE users SET role='user' WHERE id=$1", [outsider]);
  assert.equal((await request(outsider, 'GET', '/users')).status, 403);
  await db.query('DELETE FROM users WHERE id=$1', [outsider]);
  assert.equal((await request(outsider, 'GET', '/projects')).status, 401);
});

test('legacy ownerless projects stay ownerless and only admins or explicit members can access them', async () => {
  const legacy = (await db.query("INSERT INTO projects(name,client_name,start_date) VALUES ('Legacy','Client','2026-09-23') RETURNING id")).rows[0].id;
  assert.equal((await request(owner, 'GET', `/projects/${legacy}`)).status, 403);
  const response = await (await request(manager, 'GET', `/projects/${legacy}`)).json();
  assert.equal(response.createdBy, null);
  assert.equal(response.canDelete, true);
  await db.query('INSERT INTO project_members VALUES ($1,$2)', [legacy, member]);
  assert.equal((await request(member, 'GET', `/projects/${legacy}`)).status, 200);
  assert.equal((await request(member, 'DELETE', `/projects/${legacy}`)).status, 403);
  assert.equal((await request(manager, 'DELETE', `/projects/${legacy}`)).status, 204);
  assert.equal((await request(owner, 'DELETE', `/projects/${project.id}`)).status, 204);
});
