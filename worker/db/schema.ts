import { sql } from 'drizzle-orm'
import { check, foreignKey, index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: integer().primaryKey(),
  googleSub: text('google_sub').notNull().unique(),
  email: text().notNull(),
  name: text().notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$default(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$default(() => new Date()).$onUpdate(() => new Date()),
})

export const categories = sqliteTable('categories', {
  id: integer().primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  name: text().notNull(),
  kind: text({ enum: ['expense', 'income'] }).notNull(),
}, table => [
  unique('categories_user_id_id_unique').on(table.userId, table.id),
  unique('categories_user_id_name_unique').on(table.userId, table.name),
  check('categories_kind_check', sql`${table.kind} IN ('expense', 'income')`),
])

export const transactions = sqliteTable('transactions', {
  id: integer().primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  occurredAt: integer('occurred_at', { mode: 'timestamp_ms' }).notNull(),
  kind: text({ enum: ['expense', 'income'] }).notNull(),
  amount: integer().notNull(),
  categoryId: integer('category_id'),
  memo: text().notNull().default(''),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$default(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$default(() => new Date()).$onUpdate(() => new Date()),
}, table => [
  foreignKey({
    columns: [table.userId, table.categoryId],
    foreignColumns: [categories.userId, categories.id],
  }),
  index('transactions_user_occurred_at').on(table.userId, table.occurredAt),
  check('transactions_kind_check', sql`${table.kind} IN ('expense', 'income')`),
  check('transactions_amount_check', sql`${table.amount} > 0`),
])
