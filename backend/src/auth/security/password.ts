import { scrypt, timingSafeEqual } from 'node:crypto';

const HASH_PATTERN = /^scrypt\$v1\$131072\$8\$1\$([a-f0-9]{32})\$([a-f0-9]{128})$/i;
const DUMMY_SALT = Buffer.alloc(16);
const DUMMY_KEY = Buffer.alloc(64);

/** Only the existing, fixed-cost format is accepted; stored values cannot raise memory usage. */
export async function verifyPassword(password: string, storedHash: string | null): Promise<boolean> {
  const match = storedHash?.match(HASH_PATTERN);
  const salt = match ? Buffer.from(match[1], 'hex') : DUMMY_SALT;
  const expected = match ? Buffer.from(match[2], 'hex') : DUMMY_KEY;
  // Unknown users and malformed hashes still perform the same expensive operation.
  const actual = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
  const matches = timingSafeEqual(actual, expected);
  return Boolean(match) && matches;
}
