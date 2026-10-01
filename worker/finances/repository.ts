import { and, desc, eq, gte, lt } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'

import { transactions } from '../db/schema'

export const listTransactions = (db: DrizzleD1Database, userId: number, { start, end }: { start: number, end: number }) =>
  db.select({
    id: transactions.id,
    occurredAt: transactions.occurredAt,
    kind: transactions.kind,
    amount: transactions.amount,
    memo: transactions.memo,
  })
    .from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      gte(transactions.occurredAt, new Date(start)),
      lt(transactions.occurredAt, new Date(end)),
    ))
    .orderBy(desc(transactions.occurredAt), desc(transactions.id))
