import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema';
import { env } from './env';

let _db: NodePgDatabase<typeof schema> | null = null;
let _pool: Pool | null = null;

/**
 * Lazily initialize the Drizzle client.
 * Re-uses a single PostgreSQL connection pool per process.
 */
export function getDb(): NodePgDatabase<typeof schema> {
  if (!_db) {
    if (!env.databaseUrl) {
      throw new Error('DATABASE_URL is not set');
    }
    _pool = new Pool({ connectionString: env.databaseUrl });
    _db = drizzle(_pool, { schema });
  }
  return _db;
}

/**
 * Close the connection pool (used during graceful shutdown / tests).
 */
export async function closeDb(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
  }
}

// Export schema for convenient imports in services
export { schema };
