import { getDb } from '../config/database';

interface CreateCategoryInput {
  name: string;
  type: 'income' | 'expense';
  icon?: string;
  color?: string;
  userId: string;
}

/**
 * Get categories (default + owner's custom)
 */
export async function getCategories(ownerId: string) {
  const db = getDb();

  const { data, error } = await db
    .from('categories')
    .select('*')
    .or(`is_default.eq.true,user_id.eq.${ownerId}`)
    .order('is_default', { ascending: false })
    .order('name');

  if (error) throw new Error(`Gagal memuat kategori: ${error.message}`);

  return data || [];
}

/**
 * Create a custom category
 */
export async function createCategory(input: CreateCategoryInput) {
  const db = getDb();

  const { data, error } = await db
    .from('categories')
    .insert({
      name: input.name,
      type: input.type,
      icon: input.icon || null,
      color: input.color || null,
      is_default: false,
      user_id: input.userId,
    })
    .select()
    .single();

  if (error) throw new Error(`Gagal membuat kategori: ${error.message}`);

  return data;
}

/**
 * Update a custom category (cannot update defaults)
 */
export async function updateCategory(
  categoryId: number,
  ownerId: string,
  updates: Partial<CreateCategoryInput>
) {
  const db = getDb();

  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.type !== undefined) updateData.type = updates.type;
  if (updates.icon !== undefined) updateData.icon = updates.icon;
  if (updates.color !== undefined) updateData.color = updates.color;

  const { data, error } = await db
    .from('categories')
    .update(updateData)
    .eq('id', categoryId)
    .eq('user_id', ownerId)
    .eq('is_default', false)
    .select()
    .single();

  if (error) throw new Error(`Gagal mengupdate kategori: ${error.message}`);

  return data;
}

/**
 * Delete a custom category
 */
export async function deleteCategory(categoryId: number, ownerId: string) {
  const db = getDb();

  const { error } = await db
    .from('categories')
    .delete()
    .eq('id', categoryId)
    .eq('user_id', ownerId)
    .eq('is_default', false);

  if (error) throw new Error(`Gagal menghapus kategori: ${error.message}`);
}
