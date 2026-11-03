import { and, asc, desc, DrizzleQueryError, eq, gte, lt } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'

import { categories, transactions } from '../db/schema'

const transactionColumns = {
  id: transactions.id,
  occurredAt: transactions.occurredAt,
  kind: transactions.kind,
  amount: transactions.amount,
  memo: transactions.memo,
}

export const listTransactions = (db: DrizzleD1Database, userId: number, { start, end }: { start: number, end: number }) =>
  db.select(transactionColumns)
    .from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      gte(transactions.occurredAt, new Date(start)),
      lt(transactions.occurredAt, new Date(end)),
    ))
    .orderBy(desc(transactions.occurredAt), desc(transactions.id))

type TransactionValues = Pick<typeof transactions.$inferInsert, 'occurredAt' | 'kind' | 'amount' | 'memo'>

export const createTransaction = async (db: DrizzleD1Database, userId: number, values: TransactionValues) => {
  const [transaction] = await db
    .insert(transactions)
    .values({ ...values, userId })
    .returning(transactionColumns)
  return transaction
}

export const updateTransaction = async (db: DrizzleD1Database, userId: number, id: number, values: TransactionValues) => {
  const updated = await db
    .update(transactions)
    .set(values)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .returning(transactionColumns)
  return updated.at(0)
}

export const deleteTransaction = async (db: DrizzleD1Database, userId: number, id: number) => {
  const { meta } = await db
    .delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .run()
  return meta.changes > 0
}

const categoryColumns = {
  id: categories.id,
  name: categories.name,
  kind: categories.kind,
}

export const listCategories = (db: DrizzleD1Database, userId: number) =>
  db.select(categoryColumns)
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(asc(categories.id))

export const createCategory = async (
  db: DrizzleD1Database,
  userId: number,
  values: Pick<typeof categories.$inferInsert, 'name' | 'kind'>,
) => {
  const [category] = await db
    .insert(categories)
    .values({ ...values, userId })
    .returning(categoryColumns)
  return category
}

export const renameCategory = async (db: DrizzleD1Database, userId: number, id: number, name: string) => {
  const renamed = await db
    .update(categories)
    .set({ name })
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .returning(categoryColumns)
  return renamed.at(0)
}

export const deleteCategory = async (db: DrizzleD1Database, userId: number, id: number) => {
  const [, deleted] = await db.batch([
    db.update(transactions)
      .set({ categoryId: null })
      .where(and(eq(transactions.userId, userId), eq(transactions.categoryId, id))),
    db.delete(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .returning({ id: categories.id }),
  ])
  return deleted.length > 0
}

export const isDuplicateCategoryName = (error: unknown) =>
  error instanceof DrizzleQueryError
  && error.cause?.message.includes('UNIQUE constraint failed: categories.user_id, categories.kind, categories.name') === true
