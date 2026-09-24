const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scrypt } = require('node:crypto');

test('password verification accepts the provisioned scrypt format and preserves password whitespace', async () => {
  const { verifyPassword } = require('../dist/auth/security/password');
  const salt = '0123456789abcdef0123456789abcdef';
  const key = await new Promise((resolve, reject) => scrypt(' Password ', Buffer.from(salt, 'hex'), 64,
    { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }, (error, value) => error ? reject(error) : resolve(value)));
  const hash = `scrypt$v1$131072$8$1$${salt}$${key.toString('hex')}`;
  assert.equal(await verifyPassword(' Password ', hash), true);
  assert.equal(await verifyPassword('Password', hash), false);
});

test('password verification safely rejects unknown users and malformed or unsupported stored hashes', async () => {
  const { verifyPassword } = require('../dist/auth/security/password');
  for (const hash of [null, 'plaintext', 'scrypt$v1$999999999$8$1$aa$bb']) {
    assert.equal(await verifyPassword('Password', hash), false);
  }
});
