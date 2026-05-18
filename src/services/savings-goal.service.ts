import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '../config/database';
import { savingsContributions, savingsGoals } from '../db/schema';

interface CreateSavingsGoalInput {
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount?: number;
  targetDate?: string;
  icon?: string;
  color?: string;
}

interface UpdateSavingsGoalInput {
  name?: string;
  targetAmount?: number;
  currentAmount?: number;
  targetDate?: string | null;
  icon?: string;
  color?: string;
  isCompleted?: boolean;
}

interface AddContributionInput {
  goalId: number;
  userId: string;
  amount: number;
  note?: string;
}

/**
 * Get all savings goals for an owner
 */
export async function getSavingsGoals(ownerId: string) {
  const db = getDb();

  return db
    .select()
    .from(savingsGoals)
    .where(eq(savingsGoals.userId, ownerId))
    .orderBy(desc(savingsGoals.createdAt));
}

/**
 * Get a single savings goal by ID
 */
export async function getSavingsGoalById(goalId: number, ownerId: string) {
  const db = getDb();

  const [row] = await db
    .select()
    .from(savingsGoals)
    .where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.userId, ownerId)))
    .limit(1);

  if (!row) throw new Error('Target tabungan tidak ditemukan');
  return row;
}

/**
 * Create a new savings goal
 */
export async function createSavingsGoal(input: CreateSavingsGoalInput) {
  const db = getDb();

  const [row] = await db
    .insert(savingsGoals)
    .values({
      userId: input.userId,
      name: input.name,
      targetAmount: String(input.targetAmount),
      currentAmount: String(input.currentAmount ?? 0),
      targetDate: input.targetDate ?? null,
      icon: input.icon ?? '🎯',
      color: input.color ?? '#10B981',
    })
    .returning();

  if (!row) throw new Error('Gagal membuat target tabungan');
  return row;
}

/**
 * Update a savings goal
 */
export async function updateSavingsGoal(
  goalId: number,
  ownerId: string,
  updates: UpdateSavingsGoalInput,
) {
  const db = getDb();

  const updateData: Partial<typeof savingsGoals.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.targetAmount !== undefined) updateData.targetAmount = String(updates.targetAmount);
  if (updates.currentAmount !== undefined) updateData.currentAmount = String(updates.currentAmount);
  if (updates.targetDate !== undefined) updateData.targetDate = updates.targetDate ?? null;
  if (updates.icon !== undefined) updateData.icon = updates.icon;
  if (updates.color !== undefined) updateData.color = updates.color;
  if (updates.isCompleted !== undefined) updateData.isCompleted = updates.isCompleted;

  const [row] = await db
    .update(savingsGoals)
    .set(updateData)
    .where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.userId, ownerId)))
    .returning();

  if (!row) throw new Error('Target tabungan tidak ditemukan');
  return row;
}

/**
 * Delete a savings goal
 */
export async function deleteSavingsGoal(goalId: number, ownerId: string) {
  const db = getDb();

  // ON DELETE CASCADE on savings_contributions handles the children automatically.
  const result = await db
    .delete(savingsGoals)
    .where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.userId, ownerId)))
    .returning({ id: savingsGoals.id });

  if (result.length === 0) {
    throw new Error('Target tabungan tidak ditemukan');
  }
}

/**
 * Add contribution to a savings goal
 */
export async function addContribution(input: AddContributionInput) {
  const db = getDb();

  // Fetch current goal (also verifies ownership)
  const [goal] = await db
    .select({
      currentAmount: savingsGoals.currentAmount,
      targetAmount: savingsGoals.targetAmount,
    })
    .from(savingsGoals)
    .where(and(eq(savingsGoals.id, input.goalId), eq(savingsGoals.userId, input.userId)))
    .limit(1);

  if (!goal) throw new Error('Target tabungan tidak ditemukan');

  const [contribution] = await db
    .insert(savingsContributions)
    .values({
      goalId: input.goalId,
      userId: input.userId,
      amount: String(input.amount),
      note: input.note ?? null,
    })
    .returning();

  if (!contribution) throw new Error('Gagal menambah kontribusi');

  const newAmount = Number(goal.currentAmount) + input.amount;
  const isCompleted = newAmount >= Number(goal.targetAmount);

  const [updatedGoal] = await db
    .update(savingsGoals)
    .set({
      currentAmount: String(newAmount),
      isCompleted,
      updatedAt: new Date(),
    })
    .where(and(eq(savingsGoals.id, input.goalId), eq(savingsGoals.userId, input.userId)))
    .returning();

  return { contribution, goal: updatedGoal };
}

/**
 * Get contributions for a savings goal
 */
export async function getContributions(goalId: number, ownerId: string) {
  const db = getDb();

  // Verify ownership
  const [goal] = await db
    .select({ id: savingsGoals.id })
    .from(savingsGoals)
    .where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.userId, ownerId)))
    .limit(1);

  if (!goal) throw new Error('Target tabungan tidak ditemukan');

  return db
    .select()
    .from(savingsContributions)
    .where(eq(savingsContributions.goalId, goalId))
    .orderBy(desc(savingsContributions.createdAt));
}
