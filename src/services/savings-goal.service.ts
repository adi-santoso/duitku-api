import { getDb } from '../config/database';

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
  targetDate?: string;
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

  const { data, error } = await db
    .from('savings_goals')
    .select('*')
    .eq('user_id', ownerId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Gagal memuat target tabungan: ${error.message}`);

  return data || [];
}

/**
 * Get a single savings goal by ID
 */
export async function getSavingsGoalById(goalId: number, ownerId: string) {
  const db = getDb();

  const { data, error } = await db
    .from('savings_goals')
    .select('*')
    .eq('id', goalId)
    .eq('user_id', ownerId)
    .single();

  if (error) throw new Error(`Target tabungan tidak ditemukan`);

  return data;
}

/**
 * Create a new savings goal
 */
export async function createSavingsGoal(input: CreateSavingsGoalInput) {
  const db = getDb();

  const { data, error } = await db
    .from('savings_goals')
    .insert({
      user_id: input.userId,
      name: input.name,
      target_amount: input.targetAmount,
      current_amount: input.currentAmount || 0,
      target_date: input.targetDate || null,
      icon: input.icon || '🎯',
      color: input.color || '#10B981',
    })
    .select()
    .single();

  if (error) throw new Error(`Gagal membuat target tabungan: ${error.message}`);

  return data;
}

/**
 * Update a savings goal
 */
export async function updateSavingsGoal(
  goalId: number,
  ownerId: string,
  updates: UpdateSavingsGoalInput
) {
  const db = getDb();

  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.targetAmount !== undefined) updateData.target_amount = updates.targetAmount;
  if (updates.currentAmount !== undefined) updateData.current_amount = updates.currentAmount;
  if (updates.targetDate !== undefined) updateData.target_date = updates.targetDate;
  if (updates.icon !== undefined) updateData.icon = updates.icon;
  if (updates.color !== undefined) updateData.color = updates.color;
  if (updates.isCompleted !== undefined) updateData.is_completed = updates.isCompleted;
  updateData.updated_at = new Date().toISOString();

  const { data, error } = await db
    .from('savings_goals')
    .update(updateData)
    .eq('id', goalId)
    .eq('user_id', ownerId)
    .select()
    .single();

  if (error) throw new Error(`Gagal mengupdate target tabungan: ${error.message}`);

  return data;
}

/**
 * Delete a savings goal
 */
export async function deleteSavingsGoal(goalId: number, ownerId: string) {
  const db = getDb();

  // Delete contributions first
  await db
    .from('savings_contributions')
    .delete()
    .eq('goal_id', goalId);

  const { error } = await db
    .from('savings_goals')
    .delete()
    .eq('id', goalId)
    .eq('user_id', ownerId);

  if (error) throw new Error(`Gagal menghapus target tabungan: ${error.message}`);
}

/**
 * Add contribution to a savings goal
 */
export async function addContribution(input: AddContributionInput) {
  const db = getDb();

  // Get current goal
  const { data: goal, error: goalError } = await db
    .from('savings_goals')
    .select('current_amount, target_amount')
    .eq('id', input.goalId)
    .eq('user_id', input.userId)
    .single();

  if (goalError || !goal) throw new Error('Target tabungan tidak ditemukan');

  // Insert contribution record
  const { data: contribution, error: contribError } = await db
    .from('savings_contributions')
    .insert({
      goal_id: input.goalId,
      user_id: input.userId,
      amount: input.amount,
      note: input.note || null,
    })
    .select()
    .single();

  if (contribError) throw new Error(`Gagal menambah kontribusi: ${contribError.message}`);

  // Update goal current_amount
  const newAmount = Number(goal.current_amount) + input.amount;
  const isCompleted = newAmount >= Number(goal.target_amount);

  const { data: updatedGoal, error: updateError } = await db
    .from('savings_goals')
    .update({
      current_amount: newAmount,
      is_completed: isCompleted,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.goalId)
    .eq('user_id', input.userId)
    .select()
    .single();

  if (updateError) throw new Error(`Gagal mengupdate saldo: ${updateError.message}`);

  return { contribution, goal: updatedGoal };
}

/**
 * Get contributions for a savings goal
 */
export async function getContributions(goalId: number, ownerId: string) {
  const db = getDb();

  // Verify ownership
  const { error: goalError } = await db
    .from('savings_goals')
    .select('id')
    .eq('id', goalId)
    .eq('user_id', ownerId)
    .single();

  if (goalError) throw new Error('Target tabungan tidak ditemukan');

  const { data, error } = await db
    .from('savings_contributions')
    .select('*')
    .eq('goal_id', goalId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Gagal memuat riwayat kontribusi: ${error.message}`);

  return data || [];
}
