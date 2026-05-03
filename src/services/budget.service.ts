import { getDb } from '../config/database';

interface CreateBudgetInput {
  userId: string;
  categoryId: number;
  amount: number;
  period: 'monthly' | 'yearly';
  startDate: string;
}

/**
 * Get all budgets for an owner
 */
export async function getBudgets(ownerId: string) {
  const db = getDb();

  const { data, error } = await db
    .from('budgets')
    .select('*, categories(name, icon, color)')
    .eq('user_id', ownerId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Gagal memuat anggaran: ${error.message}`);

  return data || [];
}

/**
 * Create a new budget
 */
export async function createBudget(input: CreateBudgetInput) {
  const db = getDb();

  // Check if budget already exists for this category
  const { data: existing } = await db
    .from('budgets')
    .select('id')
    .eq('user_id', input.userId)
    .eq('category_id', input.categoryId)
    .maybeSingle();

  if (existing) {
    throw new Error('Budget untuk kategori ini sudah ada');
  }

  const { data, error } = await db
    .from('budgets')
    .insert({
      user_id: input.userId,
      category_id: input.categoryId,
      amount: input.amount,
      period: input.period,
      start_date: input.startDate,
    })
    .select('*, categories(name, icon, color)')
    .single();

  if (error) throw new Error(`Gagal membuat anggaran: ${error.message}`);

  return data;
}

/**
 * Update a budget
 */
export async function updateBudget(
  budgetId: number,
  ownerId: string,
  updates: { amount?: number; period?: string; startDate?: string }
) {
  const db = getDb();

  const updateData: Record<string, unknown> = {};
  if (updates.amount !== undefined) updateData.amount = updates.amount;
  if (updates.period !== undefined) updateData.period = updates.period;
  if (updates.startDate !== undefined) updateData.start_date = updates.startDate;

  const { data, error } = await db
    .from('budgets')
    .update(updateData)
    .eq('id', budgetId)
    .eq('user_id', ownerId)
    .select('*, categories(name, icon, color)')
    .single();

  if (error) throw new Error(`Gagal mengupdate anggaran: ${error.message}`);

  return data;
}

/**
 * Delete a budget
 */
export async function deleteBudget(budgetId: number, ownerId: string) {
  const db = getDb();

  const { error } = await db
    .from('budgets')
    .delete()
    .eq('id', budgetId)
    .eq('user_id', ownerId);

  if (error) throw new Error(`Gagal menghapus anggaran: ${error.message}`);
}
