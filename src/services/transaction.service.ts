import { and, desc, eq, gte, ilike, lte, sql } from 'drizzle-orm';
import { getDb } from '../config/database';
import { categories, transactions } from '../db/schema';

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

const SELECT_WITH_CATEGORY = {
  id: transactions.id,
  user_id: transactions.userId,
  category_id: transactions.categoryId,
  type: transactions.type,
  amount: transactions.amount,
  description: transactions.description,
  receipt_image: transactions.receiptImage,
  transaction_date: transactions.transactionDate,
  is_recurring: transactions.isRecurring,
  recurring_frequency: transactions.recurringFrequency,
  created_at: transactions.createdAt,
  updated_at: transactions.updatedAt,
  categories: {
    name: categories.name,
    icon: categories.icon,
    color: categories.color,
  },
} as const;

/**
 * Get transactions for a data owner (owner sees own data, staff sees owner's data)
 */
export async function getTransactions(ownerId: string, query: TransactionQuery) {
  const db = getDb();
  const limit = parseInt(query.limit || '50', 10);
  const offset = parseInt(query.offset || '0', 10);

  const filters = [eq(transactions.userId, ownerId)];
  if (query.startDate) filters.push(gte(transactions.transactionDate, query.startDate));
  if (query.endDate) filters.push(lte(transactions.transactionDate, query.endDate));
  if (query.type) filters.push(eq(transactions.type, query.type));
  if (query.categoryId) filters.push(eq(transactions.categoryId, parseInt(query.categoryId, 10)));
  if (query.search) filters.push(ilike(transactions.description, `%${query.search}%`));

  const whereClause = and(...filters);

  const [data, totalResult] = await Promise.all([
    db
      .select(SELECT_WITH_CATEGORY)
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(whereClause)
      .orderBy(desc(transactions.transactionDate))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .where(whereClause),
  ]);

  return { transactions: data, total: totalResult[0]?.count ?? 0 };
}

/**
 * Create a new transaction
 */
export async function createTransaction(input: CreateTransactionInput) {
  const db = getDb();

  const [inserted] = await db
    .insert(transactions)
    .values({
      userId: input.userId,
      categoryId: input.categoryId,
      type: input.type,
      amount: String(input.amount),
      description: input.description ?? null,
      receiptImage: input.receiptImage ?? null,
      transactionDate: input.transactionDate,
      isRecurring: input.isRecurring ?? false,
      recurringFrequency: input.recurringFrequency ?? null,
    })
    .returning({ id: transactions.id });

  if (!inserted) throw new Error('Gagal membuat transaksi');

  const [row] = await db
    .select(SELECT_WITH_CATEGORY)
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(eq(transactions.id, inserted.id))
    .limit(1);

  return row;
}

/**
 * Update a transaction
 */
export async function updateTransaction(
  transactionId: number,
  ownerId: string,
  updates: Partial<CreateTransactionInput>,
) {
  const db = getDb();

  const updateData: Partial<typeof transactions.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (updates.categoryId !== undefined) updateData.categoryId = updates.categoryId;
  if (updates.type !== undefined) updateData.type = updates.type;
  if (updates.amount !== undefined) updateData.amount = String(updates.amount);
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.receiptImage !== undefined) updateData.receiptImage = updates.receiptImage;
  if (updates.transactionDate !== undefined) updateData.transactionDate = updates.transactionDate;
  if (updates.isRecurring !== undefined) updateData.isRecurring = updates.isRecurring;
  if (updates.recurringFrequency !== undefined)
    updateData.recurringFrequency = updates.recurringFrequency;

  const updated = await db
    .update(transactions)
    .set(updateData)
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, ownerId)))
    .returning({ id: transactions.id });

  if (updated.length === 0) {
    throw new Error('Transaksi tidak ditemukan');
  }

  const [row] = await db
    .select(SELECT_WITH_CATEGORY)
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(eq(transactions.id, transactionId))
    .limit(1);

  return row;
}

/**
 * Delete a transaction
 */
export async function deleteTransaction(transactionId: number, ownerId: string) {
  const db = getDb();

  const result = await db
    .delete(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, ownerId)))
    .returning({ id: transactions.id });

  if (result.length === 0) {
    throw new Error('Transaksi tidak ditemukan');
  }
}

/**
 * Get transaction summary (total income, expense, balance)
 */
export async function getTransactionSummary(
  ownerId: string,
  startDate?: string,
  endDate?: string,
) {
  const db = getDb();

  const filters = [eq(transactions.userId, ownerId)];
  if (startDate) filters.push(gte(transactions.transactionDate, startDate));
  if (endDate) filters.push(lte(transactions.transactionDate, endDate));

  const [result] = await db
    .select({
      totalIncome: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE 0 END), 0)`,
      totalExpense: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(and(...filters));

  const totalIncome = Number(result?.totalIncome ?? 0);
  const totalExpense = Number(result?.totalExpense ?? 0);

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
  };
}
