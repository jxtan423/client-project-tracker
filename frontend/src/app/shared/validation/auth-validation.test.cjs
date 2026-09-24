const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const compiled = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, "auth-validation.ts"), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const moduleUnderTest = { exports: {} };
new Function("module", "exports", compiled)(
  moduleUnderTest,
  moduleUnderTest.exports,
);
const { isApiUrl, safeReturnUrl, loginValidation } = moduleUnderTest.exports;
test("Bearer destination stays within the configured API origin and path", () => {
  assert.equal(
    isApiUrl("http://localhost:3000/projects", "http://localhost:3000"),
    true,
  );
  for (const url of [
    "http://localhost:3000.evil.test/projects",
    "http://evil.test/projects",
    "https://localhost:3000/projects",
    "http://localhost:3001/projects",
    "/projects",
    "//evil.test/projects",
  ])
    assert.equal(isApiUrl(url, "http://localhost:3000"), false);
  assert.equal(
    isApiUrl("http://localhost:3000/apix", "http://localhost:3000/api"),
    false,
  );
  assert.equal(
    isApiUrl("http://localhost:3000/api/projects", "http://localhost:3000/api"),
    true,
  );
});
test("return URLs only allow known project routes", () => {
  assert.equal(safeReturnUrl("/projects/2/tasks"), "/projects/2/tasks");
  for (const url of [
    "//evil.test",
    "https://evil.test",
    "/login",
    "/projects/../login",
    null,
  ])
    assert.equal(safeReturnUrl(url), "/projects");
});
test("login validation requires both fields and preserves password whitespace", () => {
  assert.equal(loginValidation(" user1 ", " user1 "), "");
  assert.ok(loginValidation("", "x"));
  assert.ok(loginValidation("user1", ""));
  assert.ok(loginValidation("user1", "😀".repeat(257)));
});
