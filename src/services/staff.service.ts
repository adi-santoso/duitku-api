import { and, eq } from 'drizzle-orm';
import { getDb } from '../config/database';
import { appUsers } from '../db/schema';
import { hashPassword } from '../utils/password';

interface CreateStaffInput {
  email: string;
  password: string;
  displayName?: string;
  ownerId: string;
}

interface StaffRecord {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  created_at: Date | null;
}

function toStaffRecord(row: typeof appUsers.$inferSelect): StaffRecord {
  return {
    id: row.id,
    email: row.email,
    display_name: row.displayName,
    role: row.role,
    created_at: row.createdAt,
  };
}

/**
 * Create a new staff account linked to an owner
 */
export async function createStaff(input: CreateStaffInput): Promise<StaffRecord> {
  const db = getDb();
  const email = input.email.toLowerCase();

  const existing = await db
    .select({ id: appUsers.id })
    .from(appUsers)
    .where(eq(appUsers.email, email))
    .limit(1);

  if (existing.length > 0) {
    throw new Error('Email sudah terdaftar');
  }

  const passwordHash = await hashPassword(input.password);
  const displayName = input.displayName || email.split('@')[0];

  const [staff] = await db
    .insert(appUsers)
    .values({
      email,
      passwordHash,
      displayName,
      role: 'staff',
      ownerId: input.ownerId,
    })
    .returning();

  if (!staff) throw new Error('Gagal membuat akun staff');

  return toStaffRecord(staff);
}

/**
 * Get all staff for an owner
 */
export async function getStaffList(ownerId: string): Promise<StaffRecord[]> {
  const db = getDb();

  const rows = await db
    .select()
    .from(appUsers)
    .where(and(eq(appUsers.ownerId, ownerId), eq(appUsers.role, 'staff')))
    .orderBy(appUsers.createdAt);

  return rows.map(toStaffRecord);
}

/**
 * Remove a staff account (owner only)
 */
export async function removeStaff(staffId: string, ownerId: string): Promise<void> {
  const db = getDb();

  const result = await db
    .delete(appUsers)
    .where(
      and(
        eq(appUsers.id, staffId),
        eq(appUsers.ownerId, ownerId),
        eq(appUsers.role, 'staff'),
      ),
    )
    .returning({ id: appUsers.id });

  if (result.length === 0) {
    throw new Error('Staff tidak ditemukan atau bukan milik Anda');
  }
}
