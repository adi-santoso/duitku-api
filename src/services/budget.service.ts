import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '../config/database';
import { budgets, categories } from '../db/schema';

interface CreateBudgetInput {
  userId: string;
  categoryId: number;
  amount: number;
  period: 'monthly' | 'yearly';
  startDate: string;
}

/**
 * Get all budgets for an owner, with embedded category info
 */
export async function getBudgets(ownerId: string) {
  const db = getDb();

  const rows = await db
    .select({
      id: budgets.id,
      user_id: budgets.userId,
      category_id: budgets.categoryId,
      amount: budgets.amount,
      period: budgets.period,
      start_date: budgets.startDate,
      created_at: budgets.createdAt,
      categories: {
        name: categories.name,
        icon: categories.icon,
        color: categories.color,
      },
    })
    .from(budgets)
    .leftJoin(categories, eq(budgets.categoryId, categories.id))
    .where(eq(budgets.userId, ownerId))
    .orderBy(desc(budgets.createdAt));

  return rows;
}

/**
 * Create a new budget
 */
export async function createBudget(input: CreateBudgetInput) {
  const db = getDb();

  const existing = await db
    .select({ id: budgets.id })
    .from(budgets)
    .where(and(eq(budgets.userId, input.userId), eq(budgets.categoryId, input.categoryId)))
    .limit(1);

  if (existing.length > 0) {
    throw new Error('Budget untuk kategori ini sudah ada');
  }

  const [inserted] = await db
    .insert(budgets)
    .values({
      userId: input.userId,
      categoryId: input.categoryId,
      amount: String(input.amount),
      period: input.period,
      startDate: input.startDate,
    })
    .returning();

  if (!inserted) throw new Error('Gagal membuat anggaran');

  // Return with category info to match old shape
  const [withCategory] = await db
    .select({
      id: budgets.id,
      user_id: budgets.userId,
      category_id: budgets.categoryId,
      amount: budgets.amount,
      period: budgets.period,
      start_date: budgets.startDate,
      created_at: budgets.createdAt,
      categories: {
        name: categories.name,
        icon: categories.icon,
        color: categories.color,
      },
    })
    .from(budgets)
    .leftJoin(categories, eq(budgets.categoryId, categories.id))
    .where(eq(budgets.id, inserted.id))
    .limit(1);

  return withCategory;
}

/**
 * Update a budget
 */
export async function updateBudget(
  budgetId: number,
  ownerId: string,
  updates: { amount?: number; period?: string; startDate?: string },
) {
  const db = getDb();

  const updateData: Partial<typeof budgets.$inferInsert> = {};
  if (updates.amount !== undefined) updateData.amount = String(updates.amount);
  if (updates.period !== undefined) updateData.period = updates.period;
  if (updates.startDate !== undefined) updateData.startDate = updates.startDate;

  const updated = await db
    .update(budgets)
    .set(updateData)
    .where(and(eq(budgets.id, budgetId), eq(budgets.userId, ownerId)))
    .returning({ id: budgets.id });

  if (updated.length === 0) {
    throw new Error('Budget tidak ditemukan');
  }

  const [withCategory] = await db
    .select({
      id: budgets.id,
      user_id: budgets.userId,
      category_id: budgets.categoryId,
      amount: budgets.amount,
      period: budgets.period,
      start_date: budgets.startDate,
      created_at: budgets.createdAt,
      categories: {
        name: categories.name,
        icon: categories.icon,
        color: categories.color,
      },
    })
    .from(budgets)
    .leftJoin(categories, eq(budgets.categoryId, categories.id))
    .where(eq(budgets.id, budgetId))
    .limit(1);

  return withCategory;
}

/**
 * Delete a budget
 */
export async function deleteBudget(budgetId: number, ownerId: string) {
  const db = getDb();

  const result = await db
    .delete(budgets)
    .where(and(eq(budgets.id, budgetId), eq(budgets.userId, ownerId)))
    .returning({ id: budgets.id });

  if (result.length === 0) {
    throw new Error('Budget tidak ditemukan');
  }
}
