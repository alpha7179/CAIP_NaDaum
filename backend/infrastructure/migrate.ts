// nadaum-platform PostgreSQL 스키마 마이그레이션 러너
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MIGRATIONS_DIR = join(__dirname, 'migrations');

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('[migrate] DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const { rows } = await client.query<{ filename: string }>(
      'SELECT filename FROM schema_migrations'
    );
    const applied = new Set(rows.map((r) => r.filename));

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[migrate] skip   ${file} (already applied)`);
        continue;
      }
      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`[migrate] apply  ${file}`);
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1)',
        [file]
      );
      console.log(`[migrate] done   ${file}`);
    }

    console.log('[migrate] all migrations applied.');
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
