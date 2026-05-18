import { and, asc, desc, eq, or } from 'drizzle-orm';
import { getDb } from '../config/database';
import { categories } from '../db/schema';

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

  return db
    .select()
    .from(categories)
    .where(or(eq(categories.isDefault, true), eq(categories.userId, ownerId)))
    .orderBy(desc(categories.isDefault), asc(categories.name));
}

/**
 * Create a custom category
 */
export async function createCategory(input: CreateCategoryInput) {
  const db = getDb();

  const [row] = await db
    .insert(categories)
    .values({
      name: input.name,
      type: input.type,
      icon: input.icon ?? null,
      color: input.color ?? null,
      isDefault: false,
      userId: input.userId,
    })
    .returning();

  if (!row) throw new Error('Gagal membuat kategori');
  return row;
}

/**
 * Update a custom category (cannot update defaults)
 */
export async function updateCategory(
  categoryId: number,
  ownerId: string,
  updates: Partial<CreateCategoryInput>,
) {
  const db = getDb();

  const updateData: Partial<typeof categories.$inferInsert> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.type !== undefined) updateData.type = updates.type;
  if (updates.icon !== undefined) updateData.icon = updates.icon;
  if (updates.color !== undefined) updateData.color = updates.color;

  const [row] = await db
    .update(categories)
    .set(updateData)
    .where(
      and(
        eq(categories.id, categoryId),
        eq(categories.userId, ownerId),
        eq(categories.isDefault, false),
      ),
    )
    .returning();

  if (!row) throw new Error('Kategori tidak ditemukan atau tidak bisa diubah');
  return row;
}

/**
 * Delete a custom category
 */
export async function deleteCategory(categoryId: number, ownerId: string) {
  const db = getDb();

  const result = await db
    .delete(categories)
    .where(
      and(
        eq(categories.id, categoryId),
        eq(categories.userId, ownerId),
        eq(categories.isDefault, false),
      ),
    )
    .returning({ id: categories.id });

  if (result.length === 0) {
    throw new Error('Kategori tidak ditemukan atau tidak bisa dihapus');
  }
}
