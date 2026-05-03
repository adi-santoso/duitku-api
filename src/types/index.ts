import { Request } from 'express';

/**
 * User roles
 */
export type UserRole = 'owner' | 'staff';

/**
 * Authenticated user payload stored in JWT
 */
export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  ownerId: string; // If staff → owner's ID. If owner → own ID.
}

/**
 * Extended Express Request with authenticated user
 */
export interface AuthRequest extends Request {
  user?: JwtPayload;
}

/**
 * Standard API response
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * User record from database
 */
export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  role: UserRole;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Transaction record
 */
export interface TransactionRecord {
  id: number;
  user_id: string;
  category_id: number;
  type: 'income' | 'expense';
  amount: number;
  description: string | null;
  receipt_image: string | null;
  transaction_date: string;
  is_recurring: boolean;
  recurring_frequency: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Category record
 */
export interface CategoryRecord {
  id: number;
  name: string;
  type: 'income' | 'expense';
  icon: string | null;
  color: string | null;
  is_default: boolean;
  user_id: string | null;
  created_at: string;
}

/**
 * Budget record
 */
export interface BudgetRecord {
  id: number;
  user_id: string;
  category_id: number;
  amount: number;
  period: 'monthly' | 'yearly';
  start_date: string;
  created_at: string;
}
