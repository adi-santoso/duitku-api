import { eq, and, desc, sql } from 'drizzle-orm';
import { getDb } from '../config/database';
import {
  projects,
  projectItems,
  transactions,
  categories,
  type Project,
  type NewProject,
  type ProjectItem,
  type NewProjectItem,
} from '../db/schema';

/**
 * Get all projects for a user with item count and spent amount
 */
export async function getProjects(ownerId: string) {
  const db = getDb();
  const result = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      totalBudget: projects.totalBudget,
      isCompleted: projects.isCompleted,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      itemCount: sql<number>`CAST(COUNT(${projectItems.id}) AS INTEGER)`,
      purchasedCount: sql<number>`CAST(COUNT(CASE WHEN ${projectItems.isPurchased} = true THEN 1 END) AS INTEGER)`,
      totalSpent: sql<string>`COALESCE(SUM(CASE WHEN ${projectItems.isPurchased} = true THEN ${projectItems.estimatedPrice} ELSE 0 END), 0)`,
    })
    .from(projects)
    .leftJoin(projectItems, eq(projectItems.projectId, projects.id))
    .where(eq(projects.userId, ownerId))
    .groupBy(projects.id)
    .orderBy(desc(projects.createdAt));

  return result;
}

/**
 * Get project detail with all items
 */
export async function getProjectById(projectId: number, ownerId: string) {
  const db = getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, ownerId)))
    .limit(1);

  if (!project) {
    return null;
  }

  const items = await db
    .select({
      id: projectItems.id,
      projectId: projectItems.projectId,
      categoryId: projectItems.categoryId,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
      name: projectItems.name,
      estimatedPrice: projectItems.estimatedPrice,
      isPurchased: projectItems.isPurchased,
      transactionId: projectItems.transactionId,
      notes: projectItems.notes,
      createdAt: projectItems.createdAt,
      updatedAt: projectItems.updatedAt,
    })
    .from(projectItems)
    .innerJoin(categories, eq(projectItems.categoryId, categories.id))
    .where(eq(projectItems.projectId, projectId))
    .orderBy(projectItems.createdAt);

  return {
    ...project,
    items,
  };
}

/**
 * Create a new project
 */
export async function createProject(ownerId: string, data: Omit<NewProject, 'userId'>) {
  const db = getDb();
  const [project] = await db
    .insert(projects)
    .values({
      userId: ownerId,
      ...data,
    })
    .returning();

  return project;
}

/**
 * Update project
 */
export async function updateProject(
  projectId: number,
  ownerId: string,
  data: Partial<Omit<NewProject, 'userId'>>,
) {
  const db = getDb();
  const [updated] = await db
    .update(projects)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(projects.id, projectId), eq(projects.userId, ownerId)))
    .returning();

  return updated;
}

/**
 * Delete project (cascade delete items and linked transactions)
 */
export async function deleteProject(projectId: number, ownerId: string) {
  const db = getDb();
  // Get all items with transaction IDs
  const items = await db
    .select({ transactionId: projectItems.transactionId })
    .from(projectItems)
    .where(eq(projectItems.projectId, projectId));

  // Delete linked transactions first
  const transactionIds = items.filter((i) => i.transactionId).map((i) => i.transactionId!);
  if (transactionIds.length > 0) {
    await db.delete(transactions).where(
      sql`${transactions.id} IN ${sql.raw(`(${transactionIds.join(',')})`)}`,
    );
  }

  // Delete project (cascade will delete items)
  const [deleted] = await db
    .delete(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, ownerId)))
    .returning();

  return deleted;
}

/**
 * Add item to project
 */
export async function addProjectItem(
  projectId: number,
  ownerId: string,
  data: Omit<NewProjectItem, 'projectId'>,
) {
  const db = getDb();
  // Verify project ownership
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, ownerId)))
    .limit(1);

  if (!project) {
    throw new Error('Project tidak ditemukan');
  }

  const [item] = await db
    .insert(projectItems)
    .values({
      projectId,
      ...data,
    })
    .returning();

  return item;
}

/**
 * Update project item
 */
export async function updateProjectItem(
  itemId: number,
  ownerId: string,
  data: Partial<Omit<NewProjectItem, 'projectId'>>,
) {
  const db = getDb();
  // Verify ownership via project
  const [item] = await db
    .select({ projectId: projectItems.projectId })
    .from(projectItems)
    .where(eq(projectItems.id, itemId))
    .limit(1);

  if (!item) {
    throw new Error('Item tidak ditemukan');
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, item.projectId), eq(projects.userId, ownerId)))
    .limit(1);

  if (!project) {
    throw new Error('Unauthorized');
  }

  const [updated] = await db
    .update(projectItems)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(projectItems.id, itemId))
    .returning();

  return updated;
}

/**
 * Delete project item (and linked transaction if exists)
 */
export async function deleteProjectItem(itemId: number, ownerId: string) {
  const db = getDb();
  // Get item with project ownership verification
  const [item] = await db
    .select({
      id: projectItems.id,
      projectId: projectItems.projectId,
      transactionId: projectItems.transactionId,
    })
    .from(projectItems)
    .innerJoin(projects, eq(projectItems.projectId, projects.id))
    .where(and(eq(projectItems.id, itemId), eq(projects.userId, ownerId)))
    .limit(1);

  if (!item) {
    throw new Error('Item tidak ditemukan');
  }

  // Delete linked transaction if exists
  if (item.transactionId) {
    await db.delete(transactions).where(eq(transactions.id, item.transactionId));
  }

  // Delete item
  const [deleted] = await db.delete(projectItems).where(eq(projectItems.id, itemId)).returning();

  return deleted;
}

/**
 * Mark item as purchased (create transaction automatically)
 */
export async function markItemAsPurchased(
  itemId: number,
  ownerId: string,
  transactionDate: string,
) {
  const db = getDb();
  // Get item with category info and verify ownership
  const [item] = await db
    .select({
      id: projectItems.id,
      name: projectItems.name,
      estimatedPrice: projectItems.estimatedPrice,
      categoryId: projectItems.categoryId,
      projectId: projectItems.projectId,
      isPurchased: projectItems.isPurchased,
    })
    .from(projectItems)
    .innerJoin(projects, eq(projectItems.projectId, projects.id))
    .where(and(eq(projectItems.id, itemId), eq(projects.userId, ownerId)))
    .limit(1);

  if (!item) {
    throw new Error('Item tidak ditemukan');
  }

  if (item.isPurchased) {
    throw new Error('Item sudah dibeli sebelumnya');
  }

  // Create transaction
  const [transaction] = await db
    .insert(transactions)
    .values({
      userId: ownerId,
      categoryId: item.categoryId,
      type: 'expense',
      amount: item.estimatedPrice,
      description: `[Project] ${item.name}`,
      transactionDate: transactionDate,
    })
    .returning();

  // Update item
  const [updated] = await db
    .update(projectItems)
    .set({
      isPurchased: true,
      transactionId: transaction.id,
      updatedAt: new Date(),
    })
    .where(eq(projectItems.id, itemId))
    .returning();

  return {
    item: updated,
    transaction,
  };
}
