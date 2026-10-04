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

export const createTransaction = async (
  db: DrizzleD1Database,
  userId: number,
  values: Pick<typeof transactions.$inferInsert, 'occurredAt' | 'kind' | 'amount' | 'memo'>,
) => {
  const [transaction] = await db
    .insert(transactions)
    .values({ ...values, userId })
    .returning(transactionColumns)
  return transaction
}
