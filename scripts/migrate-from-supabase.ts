/**
 * One-time data migration: Supabase Postgres -> Neon Postgres.
 *
 * Reads from SUPABASE_CONNECTION_STRING and writes to DATABASE_URL.
 *
 * Order of operations:
 *   1. app_users          (preserve UUIDs so existing transactions still link)
 *   2. categories         (preserve IDs; default categories use ON CONFLICT DO NOTHING)
 *   3. budgets            (preserve IDs)
 *   4. transactions       (preserve IDs; chunk inserts to avoid timeouts)
 *   5. savings_goals      (only if exists in source)
 *   6. savings_contributions
 *   7. Reset all sequences to MAX(id)
 *
 * Usage:
 *   npm run data:migrate-from-supabase
 *
 * Idempotent: re-running will skip rows that already exist (via ON CONFLICT DO NOTHING).
 */
import 'dotenv/config';
import pg from 'pg';
import { neonConfig, Pool as NeonPool } from '@neondatabase/serverless';
import ws from 'ws';

if (typeof WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

const { Pool: PgPool } = pg;

const SUPABASE_URL = process.env.SUPABASE_CONNECTION_STRING;
const NEON_URL = process.env.DATABASE_URL;

if (!SUPABASE_URL) throw new Error('SUPABASE_CONNECTION_STRING is required');
if (!NEON_URL) throw new Error('DATABASE_URL is required');

const supabase = new PgPool({
  connectionString: SUPABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const neon = new NeonPool({ connectionString: NEON_URL });

async function tableExists(name: string): Promise<boolean> {
  const { rows } = await supabase.query(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1) AS exists`,
    [name],
  );
  return rows[0]?.exists === true;
}

async function migrateAppUsers() {
  console.log('\n[1/6] Migrating app_users...');
  const { rows } = await supabase.query(`SELECT * FROM app_users ORDER BY created_at`);
  console.log(`  source rows: ${rows.length}`);

  let inserted = 0;
  for (const r of rows) {
    const result = await neon.query(
      `INSERT INTO app_users (id, email, password_hash, display_name, role, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      [
        r.id,
        r.email,
        r.password_hash,
        r.display_name,
        r.role,
        r.owner_id,
        r.created_at,
        r.updated_at,
      ],
    );
    if (result.rowCount && result.rowCount > 0) inserted++;
  }
  console.log(`  inserted: ${inserted} (skipped: ${rows.length - inserted})`);
}

async function migrateCategories() {
  console.log('\n[2/6] Migrating categories...');
  const { rows } = await supabase.query(`SELECT * FROM categories ORDER BY id`);
  console.log(`  source rows: ${rows.length}`);

  let inserted = 0;
  for (const r of rows) {
    const result = await neon.query(
      `INSERT INTO categories (id, name, type, icon, color, is_default, user_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      [r.id, r.name, r.type, r.icon, r.color, r.is_default, r.user_id, r.created_at],
    );
    if (result.rowCount && result.rowCount > 0) inserted++;
  }
  console.log(`  inserted: ${inserted} (skipped: ${rows.length - inserted})`);
}

async function migrateBudgets() {
  console.log('\n[3/6] Migrating budgets...');
  const { rows } = await supabase.query(`SELECT * FROM budgets ORDER BY id`);
  console.log(`  source rows: ${rows.length}`);

  let inserted = 0;
  for (const r of rows) {
    const result = await neon.query(
      `INSERT INTO budgets (id, user_id, category_id, amount, period, start_date, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [r.id, r.user_id, r.category_id, r.amount, r.period, r.start_date, r.created_at],
    );
    if (result.rowCount && result.rowCount > 0) inserted++;
  }
  console.log(`  inserted: ${inserted} (skipped: ${rows.length - inserted})`);
}

async function migrateTransactions() {
  console.log('\n[4/6] Migrating transactions...');
  const { rows: total } = await supabase.query(`SELECT COUNT(*)::int AS c FROM transactions`);
  const expected = total[0].c;
  console.log(`  source rows: ${expected}`);

  const CHUNK = 500;
  let offset = 0;
  let inserted = 0;

  while (offset < expected) {
    const { rows } = await supabase.query(
      `SELECT * FROM transactions ORDER BY id LIMIT ${CHUNK} OFFSET ${offset}`,
    );
    if (rows.length === 0) break;

    for (const r of rows) {
      const result = await neon.query(
        `INSERT INTO transactions (id, user_id, category_id, type, amount, description,
                                   receipt_image, transaction_date, is_recurring, recurring_frequency,
                                   created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO NOTHING`,
        [
          r.id,
          r.user_id,
          r.category_id,
          r.type,
          r.amount,
          r.description,
          r.receipt_image,
          r.transaction_date,
          r.is_recurring,
          r.recurring_frequency,
          r.created_at,
          r.updated_at,
        ],
      );
      if (result.rowCount && result.rowCount > 0) inserted++;
    }

    offset += rows.length;
    process.stdout.write(`\r  progress: ${offset}/${expected}`);
  }
  process.stdout.write('\n');
  console.log(`  inserted: ${inserted} (skipped: ${expected - inserted})`);
}

async function migrateSavings() {
  console.log('\n[5/6] Migrating savings_goals...');
  if (!(await tableExists('savings_goals'))) {
    console.log('  source table does not exist, skipping.');
    return;
  }

  const { rows: goals } = await supabase.query(`SELECT * FROM savings_goals ORDER BY id`);
  console.log(`  source goals: ${goals.length}`);
  let goalsInserted = 0;
  for (const r of goals) {
    const result = await neon.query(
      `INSERT INTO savings_goals (id, user_id, name, target_amount, current_amount,
                                  target_date, icon, color, is_completed, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO NOTHING`,
      [
        r.id,
        r.user_id,
        r.name,
        r.target_amount,
        r.current_amount,
        r.target_date,
        r.icon,
        r.color,
        r.is_completed,
        r.created_at,
        r.updated_at,
      ],
    );
    if (result.rowCount && result.rowCount > 0) goalsInserted++;
  }
  console.log(`  goals inserted: ${goalsInserted}`);

  console.log('\n[6/6] Migrating savings_contributions...');
  if (!(await tableExists('savings_contributions'))) {
    console.log('  source table does not exist, skipping.');
    return;
  }
  const { rows: contribs } = await supabase.query(
    `SELECT * FROM savings_contributions ORDER BY id`,
  );
  console.log(`  source contributions: ${contribs.length}`);
  let contribsInserted = 0;
  for (const r of contribs) {
    const result = await neon.query(
      `INSERT INTO savings_contributions (id, goal_id, user_id, amount, note, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [r.id, r.goal_id, r.user_id, r.amount, r.note, r.created_at],
    );
    if (result.rowCount && result.rowCount > 0) contribsInserted++;
  }
  console.log(`  contributions inserted: ${contribsInserted}`);
}

async function resetSequences() {
  console.log('\n[+] Resetting sequences...');
  const sequences = [
    'categories_id_seq',
    'transactions_id_seq',
    'budgets_id_seq',
    'savings_goals_id_seq',
    'savings_contributions_id_seq',
  ];
  const tables = [
    'categories',
    'transactions',
    'budgets',
    'savings_goals',
    'savings_contributions',
  ];

  for (let i = 0; i < sequences.length; i++) {
    try {
      const { rows } = await neon.query(
        `SELECT setval('${sequences[i]}', GREATEST((SELECT COALESCE(MAX(id), 0) FROM ${tables[i]}), 1)) AS val`,
      );
      console.log(`  ${sequences[i]} -> ${rows[0].val}`);
    } catch (err) {
      console.log(`  ${sequences[i]} -> skipped (${(err as Error).message})`);
    }
  }
}

async function verify() {
  console.log('\n[VERIFY] Comparing row counts...');
  const tables = [
    'app_users',
    'categories',
    'transactions',
    'budgets',
    'savings_goals',
    'savings_contributions',
  ];

  for (const t of tables) {
    let srcCount: number | string = '-';
    let dstCount: number | string = '-';
    try {
      const { rows } = await supabase.query(`SELECT COUNT(*)::int AS c FROM ${t}`);
      srcCount = rows[0].c;
    } catch {
      srcCount = 'N/A';
    }
    try {
      const { rows } = await neon.query(`SELECT COUNT(*)::int AS c FROM ${t}`);
      dstCount = rows[0].c;
    } catch {
      dstCount = 'N/A';
    }
    const ok = srcCount === dstCount ? '✓' : '✗';
    console.log(`  ${ok} ${t.padEnd(25)} supabase=${srcCount}  neon=${dstCount}`);
  }
}

async function main() {
  console.log('=== DuitKu data migration: Supabase -> Neon ===');
  console.log(`Source: ${SUPABASE_URL?.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`Target: ${NEON_URL?.replace(/:[^:@]+@/, ':****@')}`);

  try {
    await migrateAppUsers();
    await migrateCategories();
    await migrateBudgets();
    await migrateTransactions();
    await migrateSavings();
    await resetSequences();
    await verify();
    console.log('\n✅ Migration complete.');
  } catch (err) {
    console.error('\n❌ Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await supabase.end();
    await neon.end();
  }
}

main();
