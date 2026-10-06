import { and, desc, eq, gte, lt } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'

import { transactions } from '../db/schema'

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
