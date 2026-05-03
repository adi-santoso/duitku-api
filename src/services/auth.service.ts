import { getDb } from '../config/database';
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { JwtPayload, UserRole } from '../types';

interface RegisterInput {
  email: string;
  password: string;
  displayName?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface AuthResult {
  token: string;
  user: {
    id: string;
    email: string;
    displayName: string | null;
    role: UserRole;
    ownerId: string;
  };
}

/**
 * Register a new owner account
 */
export async function registerOwner(input: RegisterInput): Promise<AuthResult> {
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

  // Insert new owner
  const { data: user, error } = await db
    .from('app_users')
    .insert({
      email: input.email.toLowerCase(),
      password_hash: passwordHash,
      display_name: displayName,
      role: 'owner',
      owner_id: null,
    })
    .select()
    .single();

  if (error) throw new Error(`Gagal membuat akun: ${error.message}`);

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: 'owner',
    ownerId: user.id,
  };

  const token = generateToken(payload);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: 'owner',
      ownerId: user.id,
    },
  };
}

/**
 * Login (works for both owner and staff)
 */
export async function login(input: LoginInput): Promise<AuthResult> {
  const db = getDb();

  // Find user by email
  const { data: user, error } = await db
    .from('app_users')
    .select('*')
    .eq('email', input.email.toLowerCase())
    .maybeSingle();

  if (error) throw new Error('Terjadi kesalahan saat login');
  if (!user) throw new Error('Email atau password salah');

  // Verify password
  const isValid = await comparePassword(input.password, user.password_hash);
  if (!isValid) throw new Error('Email atau password salah');

  // Determine ownerId
  const ownerId = user.role === 'staff' ? user.owner_id : user.id;

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    ownerId,
  };

  const token = generateToken(payload);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      ownerId,
    },
  };
}
