import { getDb } from '../config/database';

interface CreateTransactionInput {
  userId: string;
  categoryId: number;
  type: 'income' | 'expense';
  amount: number;
  description?: string;
  receiptImage?: string;
  transactionDate: string;
  isRecurring?: boolean;
  recurringFrequency?: string;
}

interface TransactionQuery {
  startDate?: string;
  endDate?: string;
  type?: 'income' | 'expense';
  categoryId?: string;
  search?: string;
  limit?: string;
  offset?: string;
}

/**
 * Get transactions for a data owner (owner sees own data, staff sees owner's data)
 */
export async function getTransactions(ownerId: string, query: TransactionQuery) {
  const db = getDb();
  const limit = parseInt(query.limit || '50', 10);
  const offset = parseInt(query.offset || '0', 10);

  let q = db
    .from('transactions')
    .select('*, categories(name, icon, color)', { count: 'exact' })
    .eq('user_id', ownerId)
    .order('transaction_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (query.startDate) {
    q = q.gte('transaction_date', query.startDate);
  }
  if (query.endDate) {
    q = q.lte('transaction_date', query.endDate);
  }
  if (query.type) {
    q = q.eq('type', query.type);
  }
  if (query.categoryId) {
    q = q.eq('category_id', parseInt(query.categoryId, 10));
  }
  if (query.search) {
    q = q.ilike('description', `%${query.search}%`);
  }

  const { data, error, count } = await q;

  if (error) throw new Error(`Gagal memuat transaksi: ${error.message}`);

  return { transactions: data || [], total: count || 0 };
}

/**
 * Create a new transaction
 */
export async function createTransaction(input: CreateTransactionInput) {
  const db = getDb();

  const { data, error } = await db
    .from('transactions')
    .insert({
      user_id: input.userId,
      category_id: input.categoryId,
      type: input.type,
      amount: input.amount,
      description: input.description || null,
      receipt_image: input.receiptImage || null,
      transaction_date: input.transactionDate,
      is_recurring: input.isRecurring || false,
      recurring_frequency: input.recurringFrequency || null,
    })
    .select('*, categories(name, icon, color)')
    .single();

  if (error) throw new Error(`Gagal membuat transaksi: ${error.message}`);

  return data;
}

/**
 * Update a transaction
 */
export async function updateTransaction(
  transactionId: number,
  ownerId: string,
  updates: Partial<CreateTransactionInput>
) {
  const db = getDb();

  const updateData: Record<string, unknown> = {};
  if (updates.categoryId !== undefined) updateData.category_id = updates.categoryId;
  if (updates.type !== undefined) updateData.type = updates.type;
  if (updates.amount !== undefined) updateData.amount = updates.amount;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.receiptImage !== undefined) updateData.receipt_image = updates.receiptImage;
  if (updates.transactionDate !== undefined) updateData.transaction_date = updates.transactionDate;
  if (updates.isRecurring !== undefined) updateData.is_recurring = updates.isRecurring;
  if (updates.recurringFrequency !== undefined) updateData.recurring_frequency = updates.recurringFrequency;

  const { data, error } = await db
    .from('transactions')
    .update(updateData)
    .eq('id', transactionId)
    .eq('user_id', ownerId)
    .select('*, categories(name, icon, color)')
    .single();

  if (error) throw new Error(`Gagal mengupdate transaksi: ${error.message}`);

  return data;
}

/**
 * Delete a transaction
 */
export async function deleteTransaction(transactionId: number, ownerId: string) {
  const db = getDb();

  const { error } = await db
    .from('transactions')
    .delete()
    .eq('id', transactionId)
    .eq('user_id', ownerId);

  if (error) throw new Error(`Gagal menghapus transaksi: ${error.message}`);
}

/**
 * Get transaction summary (total income, expense, balance)
 */
export async function getTransactionSummary(ownerId: string, startDate?: string, endDate?: string) {
  const db = getDb();

  let q = db
    .from('transactions')
    .select('type, amount')
    .eq('user_id', ownerId);

  if (startDate) q = q.gte('transaction_date', startDate);
  if (endDate) q = q.lte('transaction_date', endDate);

  const { data, error } = await q;

  if (error) throw new Error(`Gagal memuat summary: ${error.message}`);

  const summary = (data || []).reduce(
    (acc, t) => {
      if (t.type === 'income') acc.totalIncome += Number(t.amount);
      else acc.totalExpense += Number(t.amount);
      return acc;
    },
    { totalIncome: 0, totalExpense: 0 }
  );

  return {
    ...summary,
    balance: summary.totalIncome - summary.totalExpense,
  };
}
