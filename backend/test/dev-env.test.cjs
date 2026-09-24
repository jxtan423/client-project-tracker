const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseEnv } = require('node:util');

const script = path.resolve(__dirname, '../scripts/ensure-dev-env.cjs');
function fixture(run) {
  const directory = mkdtempSync(path.join(tmpdir(), 'tracker-dev-env-'));
  const file = path.join(directory, '.env');
  const env = { ...process.env, NODE_ENV: 'development' };
  delete env.JWT_SECRET;
  const start = overrides => spawnSync(process.execPath, [script], { cwd: directory, env: { ...env, ...overrides }, encoding: 'utf8' });
  try { run({ file, start }); } finally { rmSync(directory, { recursive: true, force: true }); }
}

test('development startup generates a secret once without printing it', () => fixture(({ file, start }) => {
  const result = start();
  assert.equal(result.status, 0, result.stderr);
  const content = readFileSync(file, 'utf8');
  const secret = parseEnv(content).JWT_SECRET;
  assert.match(secret, /^[a-f0-9]{96}$/);
  assert.ok(!(result.stdout + result.stderr).includes(secret));
  assert.equal(start().status, 0);
  assert.equal(readFileSync(file, 'utf8'), content);
}));

test('development startup fills a blank template without losing other settings', () => fixture(({ file, start }) => {
  writeFileSync(file, '# Keep this comment\nPORT=3100\nJWT_SECRET=\n');
  assert.equal(start().status, 0);
  const content = readFileSync(file, 'utf8');
  assert.ok(content.startsWith('# Keep this comment\nPORT=3100\n'));
  assert.equal(parseEnv(content).PORT, '3100');
  assert.match(parseEnv(content).JWT_SECRET, /^[a-f0-9]{96}$/);
}));

test('explicit secrets take precedence and malformed secrets are not silently replaced', () => fixture(({ file, start }) => {
  assert.equal(start({ JWT_SECRET: 'a'.repeat(64) }).status, 0);
  assert.equal(existsSync(file), false);
  writeFileSync(file, 'JWT_SECRET=too-short\n');
  assert.notEqual(start().status, 0);
  assert.equal(readFileSync(file, 'utf8'), 'JWT_SECRET=too-short\n');
}));

test('production does not generate a development secret', () => fixture(({ file, start }) => {
  assert.notEqual(start({ NODE_ENV: 'production' }).status, 0);
  assert.equal(existsSync(file), false);
}));
