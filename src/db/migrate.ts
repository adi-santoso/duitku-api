/**
 * Migration runner. Apply pending Drizzle migrations to the database
 * specified in DATABASE_URL.
 *
 * Usage:
 *   npm run db:migrate
 *
 * Note: For schema-only changes during development, prefer `db:push`.
 *       Use this script for production-style migrations applied from
 *       generated SQL files in /drizzle.
 */
import 'dotenv/config';
import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import ws from 'ws';

if (typeof WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);

  console.log('[migrate] applying migrations from ./drizzle ...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('[migrate] done.');

  await pool.end();
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
