// Development helper: rebuild the single-file handoff after adding a migration.
// The marker runs database-setup.sql directly; Node is not needed to execute it.
const { readFileSync, readdirSync, writeFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const path = require('node:path');

const seedUsers = [
  {
    "name": "Admin",
    "username": "admin",
    "passwordHash": "scrypt$v1$131072$8$1$57155b3e97f027a2511fca3ce32754fb$d6b8295199efcf0d1c7f9d1d9a3cd0b0855c43b78f29c8430dc55c7d36b798cf82bed9d9ec44702b2877e5f0531f0d026e50d91b4db5b55d79e6e655c89df816",
    "role": "admin"
  },
  {
    "name": "user1",
    "username": "user1",
    "passwordHash": "scrypt$v1$131072$8$1$fbb09ff16602df5014c6eae7992a0f26$e244b78437460f09e6818da98c22986f6dd2c09866204516fb8196519a926814ca6758a54091f9caabebcb82e359ad15a68a970a8fbc795c69caa54624df78ed",
    "role": "user"
  },
  {
    "name": "user2",
    "username": "user2",
    "passwordHash": "scrypt$v1$131072$8$1$a28337948a916d5361da47e7c4f45518$2d4d437bd8a405ecf3f5892f906a563aaf4656c099df702ddf67600278607759e03955e3bf91e3aa8399fddf58e9f6248e2eb7081edc833d3cd932ec3b0a8398",
    "role": "user"
  },
  {
    "name": "user3",
    "username": "user3",
    "passwordHash": "scrypt$v1$131072$8$1$4329b71fbe8e00364f84f886467f62b1$5b061586bcba91a73f8d410731cad8ebbf0c0980ddbfb83609e71cbea05f4ed7a582e9525a75788328f5b915087c1890fb2d1d5938f45562e76b4cdd9407098d",
    "role": "user"
  }
];
const sqlDirectory = path.resolve(__dirname, '../../sql');
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const sections = [
`-- Client Project Tracker: standalone migration and demo-user setup.
-- PostgreSQL 17 (the Docker image used by this project).
-- Run the ENTIRE file against the target database, e.g. client_project_tracker.
-- Works in PostgreSQL SQL clients and psql; contains no client-specific commands.
-- Creates tables in public. Does not create/switch databases, drop data, or reset passwords.
-- Original numbered migrations remain in sql/ as development history.
BEGIN;
SET LOCAL search_path TO public;
SELECT pg_advisory_xact_lock(73218401);
CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    checksum text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
);`,
];

for (const filename of readdirSync(sqlDirectory).filter(name => /^\d+_[a-z0-9_]+\.sql$/.test(name)).sort()) {
  const sql = readFileSync(path.join(sqlDirectory, filename), 'utf8').replace(/\r\n/g, '\n');
  const checksum = createHash('sha256').update(sql).digest('hex');
  sections.push(`-- Migration: ${filename}
DO $migration$
BEGIN
    IF EXISTS (SELECT 1 FROM schema_migrations WHERE name = ${quote(filename)}) THEN
        IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE name = ${quote(filename)} AND checksum = ${quote(checksum)}) THEN
            RAISE EXCEPTION 'Migration history mismatch: ${filename}. Restore the original migration; do not delete history.';
        END IF;
    ELSE
${sql.trim().split('\n').map(line => '        ' + line).join('\n')}
        INSERT INTO schema_migrations (name, checksum) VALUES (${quote(filename)}, ${quote(checksum)});
    END IF;
END;
$migration$;`);
}

sections.push(`-- Demo login accounts only. Password matches username; stored as salted scrypt hashes.
-- Existing accounts are preserved, including changed passwords, names and roles.
INSERT INTO users (name, username, password_hash, role) VALUES
${seedUsers.map(user => '    (' + [user.name, user.username, user.passwordHash, user.role].map(quote).join(', ') + ')').join(',\n')}
ON CONFLICT (lower(username)) DO NOTHING;

-- Projects, tasks and project_members intentionally have no seed rows.
COMMIT;
`);
writeFileSync(path.resolve(__dirname, '../database-setup.sql'), sections.join('\n\n'));
console.log('Built backend/database-setup.sql');
