const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { Client } = require('pg');

async function migrate() {
  const sql = await readFile(path.resolve(__dirname, '../../sql/init.sql'), 'utf8');
  const client = new Client({
    connectionString: process.env.DATABASE_URL ?? 'postgresql://tracker@127.0.0.1:5432/client_project_tracker',
    connectionTimeoutMillis: 5000,
  });
  await client.connect();
  try {
    // This standalone file owns the transaction, lock, migration history and seeds.
    await client.query(sql);
    console.log('Database migrations and login accounts are up to date.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

migrate().catch(error => {
  console.error(`Migration failed: ${error.message}`);
  process.exitCode = 1;
});
