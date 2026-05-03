import { getDb } from '../config/database';
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
  created_at: string;
}

/**
 * Create a new staff account linked to an owner
 */
export async function createStaff(input: CreateStaffInput): Promise<StaffRecord> {
  const db = getDb();

  // Check if email already exists
  const { data: existing } = await db
    .from('app_users')
    .select('id')
    .eq('email', input.email.toLowerCase())
    .maybeSingle();

  if (existing) {
    throw new Error('Email sudah terdaftar');
  }

  const passwordHash = await hashPassword(input.password);
  const displayName = input.displayName || input.email.split('@')[0];

  const { data: staff, error } = await db
    .from('app_users')
    .insert({
      email: input.email.toLowerCase(),
      password_hash: passwordHash,
      display_name: displayName,
      role: 'staff',
      owner_id: input.ownerId,
    })
    .select('id, email, display_name, role, created_at')
    .single();

  if (error) throw new Error(`Gagal membuat akun staff: ${error.message}`);

  return staff;
}

/**
 * Get all staff for an owner
 */
export async function getStaffList(ownerId: string): Promise<StaffRecord[]> {
  const db = getDb();

  const { data, error } = await db
    .from('app_users')
    .select('id, email, display_name, role, created_at')
    .eq('owner_id', ownerId)
    .eq('role', 'staff')
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Gagal memuat staff: ${error.message}`);

  return data || [];
}

/**
 * Remove a staff account (owner only)
 */
export async function removeStaff(staffId: string, ownerId: string): Promise<void> {
  const db = getDb();

  // Verify staff belongs to this owner
  const { data: staff } = await db
    .from('app_users')
    .select('id')
    .eq('id', staffId)
    .eq('owner_id', ownerId)
    .eq('role', 'staff')
    .maybeSingle();

  if (!staff) {
    throw new Error('Staff tidak ditemukan atau bukan milik Anda');
  }

  const { error } = await db
    .from('app_users')
    .delete()
    .eq('id', staffId);

  if (error) throw new Error(`Gagal menghapus staff: ${error.message}`);
}
