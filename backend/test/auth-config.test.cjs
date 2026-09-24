const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { readAuthConfig } = require('../dist/auth/auth.config');

test('auth configuration rejects missing, blank or short signing secrets', () => {
 const previous = process.env.JWT_SECRET;
 try {
  for (const secret of [undefined, '', ' '.repeat(40), 'short']) {
   if (secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secret;
   assert.throws(() => readAuthConfig(), /JWT_SECRET/);
  }
  const secret = randomBytes(48).toString('hex');
  process.env.JWT_SECRET = secret;
  assert.equal(readAuthConfig().secret, secret);
 } finally {if(previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous;}
});
