import { z } from 'zod';

/**
 * Auth validation schemas
 */
export const registerSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  displayName: z.string().min(1).max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

/**
 * Staff validation schemas
 */
export const createStaffSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  displayName: z.string().min(1).max(100).optional(),
});

/**
 * Transaction validation schemas
 */
export const createTransactionSchema = z.object({
  categoryId: z.number().int().positive(),
  type: z.enum(['income', 'expense']),
  amount: z.number().positive('Amount harus lebih dari 0'),
  description: z.string().max(500).optional(),
  receiptImage: z.string().optional(),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal: YYYY-MM-DD'),
  isRecurring: z.boolean().optional().default(false),
  recurringFrequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(),
});

export const updateTransactionSchema = createTransactionSchema.partial();

/**
 * Category validation schemas
 */
export const createCategorySchema = z.object({
  name: z.string().min(1, 'Nama kategori wajib diisi').max(100),
  type: z.enum(['income', 'expense']),
  icon: z.string().max(10).optional(),
  color: z.string().max(20).optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

/**
 * Budget validation schemas
 */
export const createBudgetSchema = z.object({
  categoryId: z.number().int().positive(),
  amount: z.number().positive('Amount harus lebih dari 0'),
  period: z.enum(['monthly', 'yearly']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal: YYYY-MM-DD'),
});

export const updateBudgetSchema = z.object({
  amount: z.number().positive('Amount harus lebih dari 0').optional(),
  period: z.enum(['monthly', 'yearly']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal: YYYY-MM-DD').optional(),
});

/**
 * Query params validation
 */
export const transactionQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type: z.enum(['income', 'expense']).optional(),
  categoryId: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});
