import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'
import { beforeEach, describe, expect, it } from 'vitest'

import { transactions, users } from '../db/schema'
import { client, signedSession } from '../test/helpers'

const db = drizzle(env.DB)

const signedInUser = async (email: string) => {
  const [user] = await db
    .insert(users)
    .values({ googleSub: email, email, name: email })
    .returning({ id: users.id })
  return { id: user.id, session: await signedSession({ sub: String(user.id), email, name: email }) }
}

const transactionsApi = ({ session }: { session: string }) => client({ session }).api.finances.transactions

const insertTransaction = async (userId: number, occurredAt: string, values: Partial<typeof transactions.$inferInsert> = {}) => {
  const [transaction] = await db
    .insert(transactions)
    .values({ userId, occurredAt: new Date(occurredAt), kind: 'expense', amount: 1000, ...values })
    .returning({ id: transactions.id })
  return transaction.id
}

describe('/api/finances', () => {
  beforeEach(async () => {
    await db.delete(transactions)
    await db.delete(users)
  })

  describe('GET /api/finances/transactions', () => {
    it('returns a transaction with its time in UTC', async () => {
      const alice = await signedInUser('alice@example.com')
      const transactionId = await insertTransaction(alice.id, '2026-09-01T01:00:00.000Z', { kind: 'income', amount: 300000, memo: 'Salary' })

      const res = await transactionsApi(alice).$get({ query: { month: '2026-09' } })

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([
        { id: transactionId, occurredAt: '2026-09-01T01:00:00.000Z', kind: 'income', amount: 300000, memo: 'Salary' },
      ])
    })

    it('returns the transactions newest first', async () => {
      const alice = await signedInUser('alice@example.com')
      const older = await insertTransaction(alice.id, '2026-09-01T01:00:00.000Z')
      const newer = await insertTransaction(alice.id, '2026-09-02T01:00:00.000Z')
      // Shares its minute with `newer`, so only the ID decides which comes first
      const newest = await insertTransaction(alice.id, '2026-09-02T01:00:00.000Z')

      const res = await transactionsApi(alice).$get({ query: { month: '2026-09' } })

      expect(await res.json()).toEqual([
        expect.objectContaining({ id: newest }),
        expect.objectContaining({ id: newer }),
        expect.objectContaining({ id: older }),
      ])
    })

    it('splits months in Japan time', async () => {
      const alice = await signedInUser('alice@example.com')
      // 23:59 on August 31 in Japan time
      const lastMinuteOfAugust = await insertTransaction(alice.id, '2026-08-31T14:59:00.000Z')
      // 00:00 on September 1 in Japan time
      const firstMinuteOfSeptember = await insertTransaction(alice.id, '2026-08-31T15:00:00.000Z')

      const august = await transactionsApi(alice).$get({ query: { month: '2026-08' } })
      const september = await transactionsApi(alice).$get({ query: { month: '2026-09' } })

      expect(await august.json()).toEqual([expect.objectContaining({ id: lastMinuteOfAugust })])
      expect(await september.json()).toEqual([expect.objectContaining({ id: firstMinuteOfSeptember })])
    })

    it('leaves out the transactions of other users', async () => {
      const alice = await signedInUser('alice@example.com')
      const bob = await signedInUser('bob@example.com')
      await insertTransaction(bob.id, '2026-09-01T01:00:00.000Z')

      const res = await transactionsApi(alice).$get({ query: { month: '2026-09' } })

      expect(await res.json()).toEqual([])
    })

    it('rejects a request without a month', async () => {
      const alice = await signedInUser('alice@example.com')

      // @ts-expect-error The type requires a month, but the server still has to reject a request without one
      const res = await transactionsApi(alice).$get({ query: {} })

      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'month must be a YYYY-MM month' })
    })

    it.each([
      ['out of range', '2026-13'],
      ['that is not YYYY-MM', '2026-9'],
    ])('rejects a month %s', async (_, month) => {
      const alice = await signedInUser('alice@example.com')

      const res = await transactionsApi(alice).$get({ query: { month } })

      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'month must be a YYYY-MM month' })
    })
  })
})
