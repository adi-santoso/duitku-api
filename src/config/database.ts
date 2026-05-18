import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle, NeonDatabase } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from '../db/schema';
import { env } from './env';

// Configure neonConfig for Node.js (non-Edge) runtime.
// In Vercel serverless (Node.js runtime), the WebSocket constructor isn't
// available globally, so we wire in `ws`. Edge runtime has native WebSocket.
if (typeof WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

let _db: NeonDatabase<typeof schema> | null = null;
let _pool: Pool | null = null;

/**
 * Lazily initialize the Drizzle client.
 * Re-uses a single Pool per process to avoid exhausting Neon's connection limit.
 */
export function getDb(): NeonDatabase<typeof schema> {
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
