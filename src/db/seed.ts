/**
 * Seed default categories. Idempotent - safe to run multiple times.
 *
 * Usage:
 *   npm run db:seed
 */
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { getDb, closeDb } from '../config/database';
import { categories } from './schema';

const DEFAULT_CATEGORIES = [
  // Expense
  { id: 1, name: 'Makanan & Minuman', type: 'expense', icon: '🍔', color: '#FF6B6B' },
  { id: 2, name: 'Transport', type: 'expense', icon: '🚗', color: '#4ECDC4' },
  { id: 3, name: 'Rumah Tangga', type: 'expense', icon: '🏠', color: '#45B7D1' },
  { id: 4, name: 'Kesehatan', type: 'expense', icon: '💊', color: '#96CEB4' },
  { id: 5, name: 'Hiburan', type: 'expense', icon: '🎮', color: '#FFEAA7' },
  { id: 6, name: 'Belanja', type: 'expense', icon: '🛒', color: '#DFE6E9' },
  { id: 7, name: 'Pendidikan', type: 'expense', icon: '📚', color: '#74B9FF' },
  { id: 8, name: 'Bisnis', type: 'expense', icon: '💼', color: '#A29BFE' },
  { id: 9, name: 'Tagihan', type: 'expense', icon: '💳', color: '#FD79A8' },
  { id: 10, name: 'Lain-lain', type: 'expense', icon: '🎁', color: '#B2BEC3' },
  // Income
  { id: 11, name: 'Gaji', type: 'income', icon: '💰', color: '#00B894' },
  { id: 12, name: 'Freelance', type: 'income', icon: '💼', color: '#00CEC9' },
  { id: 13, name: 'Investasi', type: 'income', icon: '📈', color: '#FDCB6E' },
  { id: 14, name: 'Hadiah', type: 'income', icon: '🎁', color: '#E17055' },
  { id: 15, name: 'Lainnya', type: 'income', icon: '💵', color: '#636E72' },
] as const;

async function main() {
  const db = getDb();

  console.log('[seed] inserting default categories...');

  for (const cat of DEFAULT_CATEGORIES) {
    await db
      .insert(categories)
      .values({
        id: cat.id,
        name: cat.name,
        type: cat.type,
        icon: cat.icon,
        color: cat.color,
        isDefault: true,
        userId: null,
      })
      .onConflictDoNothing({ target: categories.id });
  }

  // Reset sequence so user-created categories start after defaults
  await db.execute(
    sql`SELECT setval('categories_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM categories), 15))`,
  );

  console.log(`[seed] done. inserted/skipped ${DEFAULT_CATEGORIES.length} default categories.`);
  await closeDb();
}

main().catch(async (err) => {
  console.error('[seed] failed:', err);
  await closeDb();
  process.exit(1);
});
