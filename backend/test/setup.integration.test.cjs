const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile } = require('node:fs/promises');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { Client } = require('pg');
const { verifyPassword } = require('../dist/auth/security/password');

const backend = path.resolve(__dirname, '..');

async function withDatabase(run) {
  const url = new URL(process.env.DATABASE_URL ?? 'postgresql://tracker@127.0.0.1:5432/client_project_tracker');
  const database = `tracker_setup_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  let db;
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    url.pathname = `/${database}`;
    db = new Client({ connectionString: url.toString() });
    await db.connect();
    await run(db, url.toString());
  } finally {
    if (db) await db.end();
    // This random name belongs only to the disposable database created above.
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
    await admin.end();
  }
}

test('standalone SQL initializes an empty database and preserves accounts and application data on rerun', async () => {
  await withDatabase(async (db, connectionString) => {
    const setup = await readFile(path.resolve(backend, '../sql/init.sql'), 'utf8');
    await db.query(setup);
    const users = (await db.query('SELECT id, username, role, password_hash FROM users ORDER BY username')).rows;
    assert.deepEqual(users.map(({ username, role }) => ({ username, role })), [
      { username: 'admin', role: 'admin' },
      { username: 'user1', role: 'user' },
      { username: 'user2', role: 'user' },
      { username: 'user3', role: 'user' },
    ]);
    for (const user of users) {
      assert.notEqual(user.password_hash, user.username);
      assert.equal(await verifyPassword(user.username, user.password_hash), true);
    }
    assert.equal(new Set(users.map(user => user.password_hash)).size, 4);
    for (const table of ['projects', 'tasks', 'project_members']) {
      assert.equal((await db.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count, 0);
    }
    const owner = users.find(user => user.username === 'user1').id;
    const project = (await db.query("INSERT INTO projects (name, client_name, start_date, created_by) VALUES ('Keep project', 'Client', '2026-09-24', $1) RETURNING id, version", [owner])).rows[0];
    await db.query('INSERT INTO project_members (project_id, user_id) VALUES ($1, $2)', [project.id, owner]);
    const task = (await db.query("INSERT INTO tasks (title, project_id, assignee_id) VALUES ('Keep task', $1, $2) RETURNING id, version", [project.id, owner])).rows[0];
    assert.equal(project.version, 1);
    assert.equal(task.version, 1);
    assert.equal((await db.query("UPDATE projects SET name = 'Changed project' WHERE id = $1 RETURNING version", [project.id])).rows[0].version, 2);
    assert.equal((await db.query("UPDATE tasks SET title = 'Changed task' WHERE id = $1 RETURNING version", [task.id])).rows[0].version, 2);
    // Changing seed credentials/roles must never be undone by a setup rerun.
    await db.query("UPDATE users SET name = 'Renamed', username = 'USER1', password_hash = 'replacement-hash', role = 'admin' WHERE id = $1", [owner]);
    const before = {};
    for (const table of ['users', 'projects', 'tasks', 'project_members', 'schema_migrations']) {
      before[table] = (await db.query(`SELECT * FROM ${table} ORDER BY 1, 2`)).rows;
    }
    await db.query(setup);
    execFileSync(process.execPath, ['scripts/migrate.cjs'], {
      cwd: backend,
      env: { ...process.env, DATABASE_URL: connectionString },
      encoding: 'utf8',
    });
    for (const [table, expected] of Object.entries(before)) {
      assert.deepEqual((await db.query(`SELECT * FROM ${table} ORDER BY 1, 2`)).rows, expected, `${table} is preserved`);
    }
    assert.equal(before.schema_migrations.length, 3);
    assert.deepEqual(before.schema_migrations.map(row => row.name), [
      '001_initial_schema.sql', '002_access_control.sql', '003_optimistic_versioning.sql',
    ]);
    for (const migration of before.schema_migrations) assert.match(migration.checksum, /^[a-f0-9]{64}$/);
  });
});

test('standalone SQL rejects inconsistent migration history instead of silently replacing it', async () => {
  await withDatabase(async db => {
    const setup = await readFile(path.resolve(backend, '../sql/init.sql'), 'utf8');
    await db.query(setup);
    await db.query("UPDATE schema_migrations SET checksum = 'changed' WHERE name = '001_initial_schema.sql'");
    await assert.rejects(db.query(setup), /Migration history mismatch/);
    await db.query('ROLLBACK');
    assert.equal((await db.query('SELECT count(*)::int AS count FROM users')).rows[0].count, 4);
    assert.equal((await db.query("SELECT checksum FROM schema_migrations WHERE name = '001_initial_schema.sql'")).rows[0].checksum, 'changed');
  });
});

test('standalone SQL restores a missing seed account while preserving other accounts and history', async () => {
  await withDatabase(async db => {
    const setup = await readFile(path.resolve(backend, '../sql/init.sql'), 'utf8');
    await db.query(setup);
    await db.query("UPDATE users SET name='Existing user', password_hash='existing-hash', role='admin' WHERE username='user2'");
    await db.query("DELETE FROM users WHERE username='user3'");
    const users = (await db.query('SELECT * FROM users ORDER BY id')).rows;
    const history = (await db.query('SELECT * FROM schema_migrations ORDER BY name')).rows;
    await db.query(setup);
    assert.deepEqual((await db.query('SELECT * FROM schema_migrations ORDER BY name')).rows, history);
    assert.deepEqual((await db.query("SELECT * FROM users WHERE username <> 'user3' ORDER BY id")).rows, users);
    const restored = (await db.query("SELECT role, password_hash FROM users WHERE username='user3'")).rows[0];
    assert.equal(restored.role, 'user');
    assert.equal(await verifyPassword('user3', restored.password_hash), true);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM users')).rows[0].count, 4);
  });
});
