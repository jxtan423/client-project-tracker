const { existsSync, readFileSync, writeFileSync, appendFileSync } = require('node:fs');
const { randomBytes } = require('node:crypto');
const { parseEnv } = require('node:util');

function ensureDevEnv() {
  const file = '.env'; // npm runs lifecycle scripts from the backend directory.
  const exists = existsSync(file);
  const content = exists ? readFileSync(file, 'utf8') : '';
  const secret = process.env.JWT_SECRET ?? parseEnv(content).JWT_SECRET;
  if (secret?.trim()) {
    if (Buffer.byteLength(secret, 'utf8') < 32) {
      throw new Error('Existing JWT_SECRET is too short. Supply at least 32 bytes; it was not overwritten.');
    }
    return;
  }
  if (process.env.JWT_SECRET !== undefined) {
    throw new Error('JWT_SECRET is blank in the shell environment. Unset it to use automatic local setup.');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Set JWT_SECRET explicitly in production. Automatic generation is for local development only.');
  }
  const entry = `JWT_SECRET=${randomBytes(48).toString('hex')}\n`;
  if (exists) {
    // Node uses the last definition, so a blank template can be filled without
    // rewriting unrelated settings or comments (including quoted/multiline values).
    appendFileSync(file, `${content.endsWith('\n') ? '' : '\n'}${entry}`);
  } else {
    try {
      writeFileSync(file, entry, { flag: 'wx', mode: 0o600 });
    } catch (error) {
      if (error.code === 'EEXIST') return ensureDevEnv();
      throw error;
    }
  }
  console.log('Created a local JWT secret in backend/.env. Future starts will reuse it.');
}

try { ensureDevEnv(); } catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
