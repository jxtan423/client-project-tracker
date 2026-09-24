const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { Client } = require('pg');

test('migrations initialize an empty database, preserve data on rerun, and enforce relationships', async () => {
  const url = new URL(process.env.DATABASE_URL ?? 'postgresql://tracker@127.0.0.1:5432/client_project_tracker');
  const database = `tracker_migration_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  let db;
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    url.pathname = `/${database}`;
    db = new Client({ connectionString: url.toString() });
    await db.connect();
    const migrate = () => execFileSync(process.execPath, ['scripts/migrate.cjs'], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, DATABASE_URL: url.toString() },
      encoding: 'utf8',
    });
    migrate();
    const tables = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    assert.deepEqual(tables.rows.map(row => row.table_name), ['project_members', 'projects', 'schema_migrations', 'tasks', 'users']);
    const user = (await db.query("INSERT INTO users (name, username, password_hash) VALUES ('Alice', 'alice', 'test-only-hash') RETURNING id")).rows[0].id;
    const outsider = (await db.query("INSERT INTO users (name, username, password_hash) VALUES ('Bob', 'bob', 'test-only-hash') RETURNING id")).rows[0].id;
    const project = (await db.query("INSERT INTO projects (name, client_name, start_date) VALUES ('Website', 'Client', '2026-09-21') RETURNING id")).rows[0].id;
    await db.query('INSERT INTO project_members (project_id, user_id) VALUES ($1, $2)', [project, user]);
    await assert.rejects(db.query('INSERT INTO project_members VALUES ($1, $2)', [project, user]), { code: '23505' });
    await assert.rejects(db.query("INSERT INTO users (name, username, password_hash) VALUES ('Other', 'ALICE', 'test-only-hash')"), { code: '23505' });
    await assert.rejects(db.query("INSERT INTO tasks (title, project_id, assignee_id) VALUES ('Invalid', $1, $2)", [project, outsider]), { code: '23503' });
    await assert.rejects(db.query("INSERT INTO tasks (title, project_id, status) VALUES ('Invalid', $1, 'unknown')", [project]), { code: '23514' });
    await assert.rejects(db.query("INSERT INTO tasks (title, project_id) VALUES ('Orphan', -1)"), { code: '23503' });
    await db.query("INSERT INTO tasks (title, project_id, assignee_id) VALUES ('Implement', $1, $2)", [project, user]);
    await db.query("INSERT INTO tasks (title, project_id) VALUES ('Unassigned', $1)", [project]);
    await assert.rejects(db.query('DELETE FROM project_members WHERE project_id = $1 AND user_id = $2', [project, user]), { code: '23503' });
    migrate();
    assert.equal((await db.query('SELECT count(*)::int AS count FROM tasks')).rows[0].count, 2);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM schema_migrations')).rows[0].count, 3);
    assert.equal((await db.query('SELECT version FROM tasks LIMIT 1')).rows[0].version, 1);
    await db.query('DELETE FROM projects WHERE id = $1', [project]);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM tasks')).rows[0].count, 0);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM project_members')).rows[0].count, 0);
  } finally {
    if (db) await db.end();
    // Only the uniquely named disposable database created by this test is dropped.
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
    await admin.end();
  }
});
