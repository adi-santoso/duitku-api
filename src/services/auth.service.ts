import { eq } from 'drizzle-orm';
import { getDb } from '../config/database';
import { appUsers } from '../db/schema';
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
  const email = input.email.toLowerCase();

  // Check if email already exists
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

  const [user] = await db
    .insert(appUsers)
    .values({
      email,
      passwordHash,
      displayName,
      role: 'owner',
      ownerId: null,
    })
    .returning();

  if (!user) throw new Error('Gagal membuat akun');

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
      displayName: user.displayName,
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
  const email = input.email.toLowerCase();

  const [user] = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.email, email))
    .limit(1);

  if (!user) throw new Error('Email atau password salah');

  const isValid = await comparePassword(input.password, user.passwordHash);
  if (!isValid) throw new Error('Email atau password salah');

  const role = user.role as UserRole;
  const ownerId = role === 'staff' ? user.ownerId! : user.id;

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role,
    ownerId,
  };

  const token = generateToken(payload);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role,
      ownerId,
    },
  };
}
