const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = path.join(__dirname, 'project-validation.ts');
const implementation = { exports: {} };
if (fs.existsSync(source)) {
  const compiled = ts.transpileModule(fs.readFileSync(source, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('module', 'exports', compiled)(implementation, implementation.exports);
}

test('project names accept 200 Unicode characters and reject blank, oversized and null-byte text', () => {
  const { projectTextError } = implementation.exports;
  assert.equal(typeof projectTextError, 'function', 'project text validation is implemented');
  assert.equal(projectTextError('  Client website  '), null);
  assert.equal(projectTextError('😀'.repeat(200)), null);
  assert.ok(projectTextError('😀'.repeat(201)));
  assert.ok(projectTextError(' \t\n '));
  assert.ok(projectTextError('Bad\u0000name'));
});

test('project dates enforce real YYYY-MM-DD calendar days without Date normalization', () => {
  const { isCalendarDate } = implementation.exports;
  assert.equal(typeof isCalendarDate, 'function', 'calendar validation is implemented');
  for (const date of ['0001-01-01', '9999-12-31', '2024-02-29', '2000-02-29']) {
    assert.equal(isCalendarDate(date), true, date);
  }
  for (const date of ['', '0000-01-01', '2026-02-29', '1900-02-29', '2026-04-31', '2026-00-01', '2026-01-00', '2026-13-01', '2026-9-21', '2026-09-21T00:00:00Z']) {
    assert.equal(isCalendarDate(date), false, date);
  }
});
