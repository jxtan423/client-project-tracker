const { before, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

let HttpErrorResponse, apiError;
before(async () => {
  // Load the real Angular error type; no service or network is mocked.
  await import('@angular/compiler');
  const http = await import('@angular/common/http');
  HttpErrorResponse = http.HttpErrorResponse;
  const source = fs.readFileSync(path.join(__dirname, '../../core/api-error.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleUnderTest = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(
    name => name === '@angular/common/http' ? http : require(name),
    moduleUnderTest, moduleUnderTest.exports,
  );
  apiError = moduleUnderTest.exports.apiError;
});

test('403 explains insufficient access instead of showing a generic Forbidden response', () => {
  const error = new HttpErrorResponse({ status: 403, error: { message: 'Forbidden resource' } });
  assert.equal(apiError(error).message, 'You do not have permission to perform this action. Your access may have changed.');
});

test('membership conflict messages remain actionable for the dialog', () => {
  const message = 'Unassign this member’s tasks before removing them.';
  const error = new HttpErrorResponse({ status: 409, error: { message } });
  assert.equal(apiError(error).message, message);
});
