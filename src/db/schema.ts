import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigserial,
  bigint,
  boolean,
  numeric,
  date,
  index,
  check,
} from 'drizzle-orm/pg-core';

// ============================================
// app_users - replaces Supabase Auth
// ============================================
export const appUsers = pgTable(
  'app_users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name'),
    role: text('role').notNull().default('owner'),
    // Self-reference: staff has owner_id pointing to their owner
    ownerId: uuid('owner_id').references((): any => appUsers.id, {
      onDelete: 'cascade',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    emailIdx: index('idx_app_users_email').on(t.email),
    ownerIdx: index('idx_app_users_owner_id').on(t.ownerId),
    roleIdx: index('idx_app_users_role').on(t.role),
    roleCheck: check('app_users_role_check', sql`${t.role} IN ('owner', 'staff')`),
    validRoleOwner: check(
      'valid_role_owner',
      sql`(${t.role} = 'owner' AND ${t.ownerId} IS NULL) OR (${t.role} = 'staff' AND ${t.ownerId} IS NOT NULL)`,
    ),
  }),
);

// ============================================
// categories - default + per-owner custom
// ============================================
export const categories = pgTable(
  'categories',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    name: text('name').notNull(),
    type: text('type').notNull(),
    icon: text('icon'),
    color: text('color'),
    isDefault: boolean('is_default').default(false),
    userId: uuid('user_id').references(() => appUsers.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userIdx: index('idx_categories_user_id').on(t.userId),
    typeIdx: index('idx_categories_type').on(t.type),
    typeCheck: check('categories_type_check', sql`${t.type} IN ('income', 'expense')`),
  }),
);

// ============================================
// transactions
// ============================================
export const transactions = pgTable(
  'transactions',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUsers.id, { onDelete: 'cascade' }),
    categoryId: bigint('category_id', { mode: 'number' })
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    type: text('type').notNull(),
    amount: numeric('amount').notNull(),
    description: text('description'),
    receiptImage: text('receipt_image'),
    transactionDate: date('transaction_date').notNull(),
    isRecurring: boolean('is_recurring').default(false),
    recurringFrequency: text('recurring_frequency'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userIdx: index('idx_transactions_user_id').on(t.userId),
    dateIdx: index('idx_transactions_date').on(t.transactionDate),
    userDateIdx: index('idx_transactions_user_date').on(t.userId, t.transactionDate),
    userTypeIdx: index('idx_transactions_user_type').on(t.userId, t.type),
    typeCheck: check('transactions_type_check', sql`${t.type} IN ('income', 'expense')`),
    amountCheck: check('transactions_amount_check', sql`${t.amount} >= 0`),
    recurringCheck: check(
      'transactions_recurring_frequency_check',
      sql`${t.recurringFrequency} IS NULL OR ${t.recurringFrequency} IN ('daily', 'weekly', 'monthly', 'yearly')`,
    ),
  }),
);

// ============================================
// budgets - one per (owner, category)
// ============================================
export const budgets = pgTable(
  'budgets',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUsers.id, { onDelete: 'cascade' }),
    categoryId: bigint('category_id', { mode: 'number' })
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    amount: numeric('amount').notNull(),
    period: text('period').notNull(),
    startDate: date('start_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userIdx: index('idx_budgets_user_id').on(t.userId),
    uniqueOwnerCategory: index('idx_budgets_user_category').on(t.userId, t.categoryId),
    periodCheck: check('budgets_period_check', sql`${t.period} IN ('monthly', 'yearly')`),
    amountCheck: check('budgets_amount_check', sql`${t.amount} > 0`),
  }),
);

// ============================================
// savings_goals
// ============================================
export const savingsGoals = pgTable(
  'savings_goals',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUsers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    targetAmount: numeric('target_amount').notNull(),
    currentAmount: numeric('current_amount').notNull().default('0'),
    targetDate: date('target_date'),
    icon: text('icon').default('🎯'),
    color: text('color').default('#10B981'),
    isCompleted: boolean('is_completed').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userIdx: index('idx_savings_goals_user_id').on(t.userId),
    targetCheck: check('savings_goals_target_check', sql`${t.targetAmount} > 0`),
    currentCheck: check('savings_goals_current_check', sql`${t.currentAmount} >= 0`),
  }),
);

// ============================================
// savings_contributions - history of deposits
// ============================================
export const savingsContributions = pgTable(
  'savings_contributions',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    goalId: bigint('goal_id', { mode: 'number' })
      .notNull()
      .references(() => savingsGoals.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUsers.id, { onDelete: 'cascade' }),
    amount: numeric('amount').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    goalIdx: index('idx_savings_contributions_goal_id').on(t.goalId),
    amountCheck: check('savings_contributions_amount_check', sql`${t.amount} > 0`),
  }),
);

// ============================================
// projects - project planning (e.g. renovation, shopping list)
// ============================================
export const projects = pgTable(
  'projects',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUsers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    totalBudget: numeric('total_budget'),
    isCompleted: boolean('is_completed').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userIdx: index('idx_projects_user_id').on(t.userId),
    budgetCheck: check(
      'projects_total_budget_check',
      sql`${t.totalBudget} IS NULL OR ${t.totalBudget} >= 0`,
    ),
  }),
);

// ============================================
// project_items - list items in a project
// ============================================
export const projectItems = pgTable(
  'project_items',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    projectId: bigint('project_id', { mode: 'number' })
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    categoryId: bigint('category_id', { mode: 'number' })
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    estimatedPrice: numeric('estimated_price').notNull(),
    isPurchased: boolean('is_purchased').default(false),
    transactionId: bigint('transaction_id', { mode: 'number' }).references(() => transactions.id, {
      onDelete: 'cascade',
    }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    projectIdx: index('idx_project_items_project_id').on(t.projectId),
    transactionIdx: index('idx_project_items_transaction_id').on(t.transactionId),
    priceCheck: check('project_items_estimated_price_check', sql`${t.estimatedPrice} >= 0`),
  }),
);

// ============================================
// Type exports for use in services
// ============================================
export type AppUser = typeof appUsers.$inferSelect;
export type NewAppUser = typeof appUsers.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
export type SavingsGoal = typeof savingsGoals.$inferSelect;
export type NewSavingsGoal = typeof savingsGoals.$inferInsert;
export type SavingsContribution = typeof savingsContributions.$inferSelect;
export type NewSavingsContribution = typeof savingsContributions.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectItem = typeof projectItems.$inferSelect;
export type NewProjectItem = typeof projectItems.$inferInsert;
