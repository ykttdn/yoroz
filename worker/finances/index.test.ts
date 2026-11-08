import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { beforeEach, describe, expect, it } from 'vitest'

import { categories, transactions, users } from '../db/schema'
import app from '../index'
import { SESSION_COOKIE } from '../session'
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

const insertTransaction = async (
  userId: number, occurredAt: string, values: Partial<typeof transactions.$inferInsert> = {},
) => {
  const [transaction] = await db
    .insert(transactions)
    .values({ userId, occurredAt: new Date(occurredAt), kind: 'expense', amount: 1000, ...values })
    .returning({ id: transactions.id })
  return transaction.id
}

const categoriesApi = ({ session }: { session: string }) => client({ session }).api.finances.categories

const insertCategory = async (userId: number, name: string, kind: 'expense' | 'income' = 'expense') => {
  const [category] = await db
    .insert(categories)
    .values({ userId, name, kind })
    .returning({ id: categories.id })
  return category.id
}

const malformedIds: [string, (id: number) => string][] = [
  ['a word', () => 'abc'],
  ['a hex', id => `0x${id.toString(16)}`],
  ['an exponent', id => `${id}e0`],
  ['a decimal', id => `${id}.0`],
]

describe('/api/finances', () => {
  beforeEach(async () => {
    await db.delete(transactions)
    await db.delete(categories)
    await db.delete(users)
  })

  describe('GET /api/finances/transactions', () => {
    it('returns a transaction with its time in UTC', async () => {
      const alice = await signedInUser('alice@example.com')
      const transactionId = await insertTransaction(
        alice.id, '2026-09-01T01:00:00.000Z', { kind: 'income', amount: 300000, memo: 'Salary' },
      )

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
      expect(await res.json()).toEqual({ error: 'month must be a YYYY-MM month from 2000-01 to 2099-12' })
    })

    it.each([
      ['out of range', '2026-13'],
      ['before the year 2000', '1999-12'],
      ['after the year 2099', '2100-01'],
      ['that is not YYYY-MM', '2026-9'],
    ])('rejects a month %s', async (_, month) => {
      const alice = await signedInUser('alice@example.com')

      const res = await transactionsApi(alice).$get({ query: { month } })

      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'month must be a YYYY-MM month from 2000-01 to 2099-12' })
    })
  })

  describe('POST /api/finances/transactions', () => {
    const body = { occurredAt: '2026-09-27T01:30:00.000Z', kind: 'expense' as const, amount: 1200, memo: 'Lunch' }

    it('creates a transaction for the signed-in user', async () => {
      const alice = await signedInUser('alice@example.com')

      const res = await transactionsApi(alice).$post({ json: body })

      expect(res.status).toBe(201)
      const created = await res.json()
      expect(created).toEqual({ id: expect.any(Number), ...body })
      const list = await transactionsApi(alice).$get({ query: { month: '2026-09' } })
      expect(await list.json()).toEqual([created])
    })

    it('leaves the memo empty when it is left out', async () => {
      const alice = await signedInUser('alice@example.com')
      const json = { occurredAt: body.occurredAt, kind: body.kind, amount: body.amount }

      const res = await transactionsApi(alice).$post({ json })

      expect(res.status).toBe(201)
      expect(await res.json()).toEqual({ id: expect.any(Number), ...body, memo: '' })
    })

    it('ignores the keys it does not accept', async () => {
      const alice = await signedInUser('alice@example.com')
      // No category has this ID, so inserting it would break the foreign key
      const json = { ...body, categoryId: 1 }

      const res = await transactionsApi(alice).$post({ json })

      expect(res.status).toBe(201)
      expect(await res.json()).toEqual({ id: expect.any(Number), ...body })
    })

    it('accepts the largest amount', async () => {
      const alice = await signedInUser('alice@example.com')
      const json = { ...body, amount: 1_000_000 }

      const res = await transactionsApi(alice).$post({ json })

      expect(res.status).toBe(201)
      expect(await res.json()).toEqual({ id: expect.any(Number), ...json })
    })

    it('accepts the longest memo', async () => {
      const alice = await signedInUser('alice@example.com')
      const json = { ...body, memo: 'a'.repeat(200) }

      const res = await transactionsApi(alice).$post({ json })

      expect(res.status).toBe(201)
      expect(await res.json()).toEqual({ id: expect.any(Number), ...json })
    })

    it.each([
      ['null as the body', null, 'The body must be a JSON object'],
      ['an array as the body', [], 'The body must be a JSON object'],
      [
        'a timestamp before the year 2000 in Japan time', { ...body, occurredAt: '1999-12-31T14:59:00.000Z' },
        'occurredAt must be in the years 2000 to 2099 in Japan time',
      ],
      [
        'a timestamp after the year 2099 in Japan time', { ...body, occurredAt: '2099-12-31T15:00:00.000Z' },
        'occurredAt must be in the years 2000 to 2099 in Japan time',
      ],
      [
        'a timestamp with an offset', { ...body, occurredAt: '2026-09-27T10:30:00.000+09:00' },
        'occurredAt must be a UTC timestamp on the minute',
      ],
      [
        'a timestamp with seconds', { ...body, occurredAt: '2026-09-27T01:30:15.000Z' },
        'occurredAt must be a UTC timestamp on the minute',
      ],
      ['an unknown kind', { ...body, kind: 'transfer' }, 'kind must be expense or income'],
      ['a zero amount', { ...body, amount: 0 }, 'amount must be an integer from 1 to 1000000'],
      ['a fractional amount', { ...body, amount: 1.5 }, 'amount must be an integer from 1 to 1000000'],
      ['an amount over the limit', { ...body, amount: 1_000_001 }, 'amount must be an integer from 1 to 1000000'],
      ['an amount as a string', { ...body, amount: '1200' }, 'amount must be an integer from 1 to 1000000'],
      ['a memo that is not a string', { ...body, memo: 1 }, 'memo must be a string'],
      ['a memo over the limit', { ...body, memo: 'a'.repeat(201) }, 'memo must be at most 200 characters'],
    ])('rejects %s', async (_, json, error) => {
      const alice = await signedInUser('alice@example.com')

      // @ts-expect-error The type rules these bodies out, but the server still has to reject them
      const res = await transactionsApi(alice).$post({ json })

      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error })
      const list = await transactionsApi(alice).$get({ query: { month: '2026-09' } })
      expect(await list.json()).toEqual([])
    })
  })

  describe('PUT /api/finances/transactions/:id', () => {
    const body = { occurredAt: '2026-09-28T03:00:00.000Z', kind: 'income' as const, amount: 5000, memo: 'Refund' }

    it('replaces the transaction with the body', async () => {
      const alice = await signedInUser('alice@example.com')
      const transactionId = await insertTransaction(alice.id, '2026-09-27T01:30:00.000Z', { memo: 'Lunch' })

      const res = await transactionsApi(alice)[':id'].$put({ param: { id: String(transactionId) }, json: body })

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ id: transactionId, ...body })
      const list = await transactionsApi(alice).$get({ query: { month: '2026-09' } })
      expect(await list.json()).toEqual([{ id: transactionId, ...body }])
    })

    it('keeps createdAt and renews updatedAt', async () => {
      const alice = await signedInUser('alice@example.com')
      const insertedAt = new Date('2026-09-27T01:30:00.000Z')
      const transactionId = await insertTransaction(
        alice.id, '2026-09-27T01:30:00.000Z', { createdAt: insertedAt, updatedAt: insertedAt },
      )

      const res = await transactionsApi(alice)[':id'].$put({ param: { id: String(transactionId) }, json: body })

      expect(res.status).toBe(200)
      const [row] = await db
        .select({ createdAt: transactions.createdAt, updatedAt: transactions.updatedAt })
        .from(transactions)
        .where(eq(transactions.id, transactionId))
      expect(row.createdAt).toEqual(insertedAt)
      expect(row.updatedAt.getTime()).toBeGreaterThan(insertedAt.getTime())
    })

    it('empties the memo when it is left out', async () => {
      const alice = await signedInUser('alice@example.com')
      const transactionId = await insertTransaction(alice.id, '2026-09-27T01:30:00.000Z', { memo: 'Lunch' })
      const json = { occurredAt: body.occurredAt, kind: body.kind, amount: body.amount }

      const res = await transactionsApi(alice)[':id'].$put({ param: { id: String(transactionId) }, json })

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ id: transactionId, ...body, memo: '' })
    })

    it('does not find a transaction of another user', async () => {
      const alice = await signedInUser('alice@example.com')
      const bob = await signedInUser('bob@example.com')
      const transactionId = await insertTransaction(bob.id, '2026-09-27T01:30:00.000Z')
      const before = await transactionsApi(bob).$get({ query: { month: '2026-09' } })

      const res = await transactionsApi(alice)[':id'].$put({ param: { id: String(transactionId) }, json: body })

      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'Not found' })
      const after = await transactionsApi(bob).$get({ query: { month: '2026-09' } })
      expect(await after.json()).toEqual(await before.json())
    })

    it('does not find a transaction that does not exist', async () => {
      const alice = await signedInUser('alice@example.com')

      const res = await transactionsApi(alice)[':id'].$put({ param: { id: '1' }, json: body })

      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'Not found' })
    })

    it.each(malformedIds)('does not find a transaction for an id written as %s', async (_, write) => {
      const alice = await signedInUser('alice@example.com')
      const transactionId = await insertTransaction(alice.id, '2026-09-27T01:30:00.000Z')
      const before = await transactionsApi(alice).$get({ query: { month: '2026-09' } })

      const res = await transactionsApi(alice)[':id'].$put({ param: { id: write(transactionId) }, json: body })

      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'Not found' })
      const after = await transactionsApi(alice).$get({ query: { month: '2026-09' } })
      expect(await after.json()).toEqual(await before.json())
    })

    it('rejects an invalid body and keeps the transaction', async () => {
      const alice = await signedInUser('alice@example.com')
      const transactionId = await insertTransaction(alice.id, '2026-09-27T01:30:00.000Z')
      const before = await transactionsApi(alice).$get({ query: { month: '2026-09' } })

      const res = await transactionsApi(alice)[':id'].$put({
        param: { id: String(transactionId) },
        json: { ...body, amount: 0 },
      })

      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'amount must be an integer from 1 to 1000000' })
      const after = await transactionsApi(alice).$get({ query: { month: '2026-09' } })
      expect(await after.json()).toEqual(await before.json())
    })
  })

  describe('DELETE /api/finances/transactions/:id', () => {
    it('deletes only the transaction with the id', async () => {
      const alice = await signedInUser('alice@example.com')
      const transactionId = await insertTransaction(alice.id, '2026-09-27T01:30:00.000Z')
      const otherId = await insertTransaction(alice.id, '2026-09-28T01:30:00.000Z')

      const res = await transactionsApi(alice)[':id'].$delete({ param: { id: String(transactionId) } })

      expect(res.status).toBe(204)
      const list = await transactionsApi(alice).$get({ query: { month: '2026-09' } })
      expect(await list.json()).toEqual([expect.objectContaining({ id: otherId })])
    })

    it('does not find a transaction of another user', async () => {
      const alice = await signedInUser('alice@example.com')
      const bob = await signedInUser('bob@example.com')
      const transactionId = await insertTransaction(bob.id, '2026-09-27T01:30:00.000Z')

      const res = await transactionsApi(alice)[':id'].$delete({ param: { id: String(transactionId) } })

      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'Not found' })
      const list = await transactionsApi(bob).$get({ query: { month: '2026-09' } })
      expect(await list.json()).toEqual([expect.objectContaining({ id: transactionId })])
    })

    it('does not find a transaction that does not exist', async () => {
      const alice = await signedInUser('alice@example.com')

      const res = await transactionsApi(alice)[':id'].$delete({ param: { id: '1' } })

      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'Not found' })
    })

    it.each(malformedIds)('does not find a transaction for an id written as %s', async (_, write) => {
      const alice = await signedInUser('alice@example.com')
      const transactionId = await insertTransaction(alice.id, '2026-09-27T01:30:00.000Z')

      const res = await transactionsApi(alice)[':id'].$delete({ param: { id: write(transactionId) } })

      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'Not found' })
      const list = await transactionsApi(alice).$get({ query: { month: '2026-09' } })
      expect(await list.json()).toEqual([expect.objectContaining({ id: transactionId })])
    })

    it('keeps the transaction when another site sends the request', async () => {
      const alice = await signedInUser('alice@example.com')
      const transactionId = await insertTransaction(alice.id, '2026-09-27T01:30:00.000Z')

      const res = await transactionsApi(alice)[':id'].$delete(
        { param: { id: String(transactionId) } },
        { headers: { Origin: 'https://evil.example.com' } },
      )

      expect(res.status).toBe(403)
      const list = await transactionsApi(alice).$get({ query: { month: '2026-09' } })
      expect(await list.json()).toEqual([expect.objectContaining({ id: transactionId })])
    })
  })

  describe('GET /api/finances/categories', () => {
    it('returns the ID, name, and kind of a category', async () => {
      const alice = await signedInUser('alice@example.com')
      const categoryId = await insertCategory(alice.id, 'Test category A', 'income')

      const res = await categoriesApi(alice).$get()

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([{ id: categoryId, name: 'Test category A', kind: 'income' }])
    })

    it('leaves out the categories of other users', async () => {
      const alice = await signedInUser('alice@example.com')
      const bob = await signedInUser('bob@example.com')
      await insertCategory(bob.id, 'Test category A')

      const res = await categoriesApi(alice).$get()

      expect(await res.json()).toEqual([])
    })
  })

  describe('POST /api/finances/categories', () => {
    const body = { name: 'Test category A', kind: 'expense' as const }

    it('creates a category for the signed-in user', async () => {
      const alice = await signedInUser('alice@example.com')

      const res = await categoriesApi(alice).$post({ json: body })

      expect(res.status).toBe(201)
      const created = await res.json()
      expect(created).toEqual({ id: expect.any(Number), ...body })
      const list = await categoriesApi(alice).$get()
      expect(await list.json()).toEqual([created])
    })

    it('removes half-width and full-width spaces around the name', async () => {
      const alice = await signedInUser('alice@example.com')

      const res = await categoriesApi(alice).$post({ json: { ...body, name: ' 　Test category A　 ' } })

      expect(res.status).toBe(201)
      expect(await res.json()).toEqual({ id: expect.any(Number), ...body })
    })

    it('accepts the longest name', async () => {
      const alice = await signedInUser('alice@example.com')
      const json = { ...body, name: 'a'.repeat(30) }

      const res = await categoriesApi(alice).$post({ json })

      expect(res.status).toBe(201)
      expect(await res.json()).toEqual({ id: expect.any(Number), ...json })
    })

    it('measures the length of a name after composing decomposed katakana', async () => {
      const alice = await signedInUser('alice@example.com')

      // 60 characters as sent, but 30 once each voiced pair becomes one character
      const res = await categoriesApi(alice).$post({ json: { ...body, name: 'ガ'.normalize('NFD').repeat(30) } })

      expect(res.status).toBe(201)
      expect(await res.json()).toEqual({ id: expect.any(Number), ...body, name: 'ガ'.repeat(30) })
    })

    it.each([
      ['null as the body', null, 'The body must be a JSON object'],
      ['a name of only spaces', { ...body, name: ' 　 ' }, 'name must not be empty'],
      ['a name over the limit', { ...body, name: 'a'.repeat(31) }, 'name must be at most 30 characters'],
      ['a name that is not a string', { ...body, name: 1 }, 'name must be a string'],
      ['an unknown kind', { ...body, kind: 'transfer' }, 'kind must be expense or income'],
    ])('rejects %s', async (_, json, error) => {
      const alice = await signedInUser('alice@example.com')

      // @ts-expect-error The type rules these bodies out, but the server still has to reject them
      const res = await categoriesApi(alice).$post({ json })

      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error })
      const list = await categoriesApi(alice).$get()
      expect(await list.json()).toEqual([])
    })

    it('rejects a name the user already has under the same kind', async () => {
      const alice = await signedInUser('alice@example.com')
      const existingId = await insertCategory(alice.id, body.name, body.kind)

      const res = await categoriesApi(alice).$post({ json: body })

      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({ error: 'A category with this name already exists' })
      const list = await categoriesApi(alice).$get()
      expect(await list.json()).toEqual([{ id: existingId, ...body }])
    })

    it('accepts a name the user already has under the other kind', async () => {
      const alice = await signedInUser('alice@example.com')
      await insertCategory(alice.id, body.name, 'income')

      const res = await categoriesApi(alice).$post({ json: body })

      expect(res.status).toBe(201)
    })

    it('accepts a name that another user already has', async () => {
      const alice = await signedInUser('alice@example.com')
      const bob = await signedInUser('bob@example.com')
      await insertCategory(bob.id, body.name)

      const res = await categoriesApi(alice).$post({ json: body })

      expect(res.status).toBe(201)
    })
  })

  describe('PUT /api/finances/categories/:id', () => {
    const body = { name: 'Test category renamed' }

    it('renames the category', async () => {
      const alice = await signedInUser('alice@example.com')
      const categoryId = await insertCategory(alice.id, 'Test category A', 'income')

      const res = await categoriesApi(alice)[':id'].$put({ param: { id: String(categoryId) }, json: body })

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ id: categoryId, name: body.name, kind: 'income' })
      const list = await categoriesApi(alice).$get()
      expect(await list.json()).toEqual([{ id: categoryId, name: body.name, kind: 'income' }])
    })

    it('saves decomposed katakana as composed', async () => {
      const alice = await signedInUser('alice@example.com')
      const categoryId = await insertCategory(alice.id, 'Test category A')

      const res = await categoriesApi(alice)[':id'].$put({
        param: { id: String(categoryId) },
        json: { name: 'テストカテゴリ'.normalize('NFD') },
      })

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual(expect.objectContaining({ id: categoryId, name: 'テストカテゴリ' }))
    })

    it('ignores a kind in the body', async () => {
      const alice = await signedInUser('alice@example.com')
      const categoryId = await insertCategory(alice.id, 'Test category A', 'income')

      const res = await categoriesApi(alice)[':id'].$put({
        param: { id: String(categoryId) },
        // @ts-expect-error The type rules out a kind, but the server still has to leave the category's kind as it is
        json: { ...body, kind: 'expense' },
      })

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ id: categoryId, name: body.name, kind: 'income' })
    })

    it('accepts the name the category already has', async () => {
      const alice = await signedInUser('alice@example.com')
      const categoryId = await insertCategory(alice.id, 'Test category A')

      const res = await categoriesApi(alice)[':id'].$put({
        param: { id: String(categoryId) },
        json: { name: 'Test category A' },
      })

      expect(res.status).toBe(200)
    })

    it('rejects a name another category has under the same kind and keeps the name', async () => {
      const alice = await signedInUser('alice@example.com')
      const categoryId = await insertCategory(alice.id, 'Test category A')
      await insertCategory(alice.id, body.name)

      const res = await categoriesApi(alice)[':id'].$put({ param: { id: String(categoryId) }, json: body })

      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({ error: 'A category with this name already exists' })
      const list = await categoriesApi(alice).$get()
      expect(await list.json()).toEqual([
        expect.objectContaining({ id: categoryId, name: 'Test category A' }),
        expect.objectContaining({ name: body.name }),
      ])
    })

    it('accepts a name another category has under the other kind', async () => {
      const alice = await signedInUser('alice@example.com')
      const categoryId = await insertCategory(alice.id, 'Test category A', 'expense')
      await insertCategory(alice.id, body.name, 'income')

      const res = await categoriesApi(alice)[':id'].$put({ param: { id: String(categoryId) }, json: body })

      expect(res.status).toBe(200)
    })

    it('does not find a category of another user', async () => {
      const alice = await signedInUser('alice@example.com')
      const bob = await signedInUser('bob@example.com')
      const categoryId = await insertCategory(bob.id, 'Test category A')

      const res = await categoriesApi(alice)[':id'].$put({ param: { id: String(categoryId) }, json: body })

      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'Not found' })
      const list = await categoriesApi(bob).$get()
      expect(await list.json()).toEqual([expect.objectContaining({ id: categoryId, name: 'Test category A' })])
    })

    it('does not find a category that does not exist', async () => {
      const alice = await signedInUser('alice@example.com')

      const res = await categoriesApi(alice)[':id'].$put({ param: { id: '1' }, json: body })

      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'Not found' })
    })

    it.each(malformedIds)('does not find a category for an id written as %s', async (_, write) => {
      const alice = await signedInUser('alice@example.com')
      const categoryId = await insertCategory(alice.id, 'Test category A')

      const res = await categoriesApi(alice)[':id'].$put({ param: { id: write(categoryId) }, json: body })

      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'Not found' })
      const list = await categoriesApi(alice).$get()
      expect(await list.json()).toEqual([expect.objectContaining({ id: categoryId, name: 'Test category A' })])
    })

    it.each([
      ['null as the body', null, 'The body must be a JSON object'],
      ['a name of only spaces', { name: ' ' }, 'name must not be empty'],
    ])('rejects %s and keeps the name', async (_, json, error) => {
      const alice = await signedInUser('alice@example.com')
      const categoryId = await insertCategory(alice.id, 'Test category A')

      // @ts-expect-error The type rules out null, but the server still has to reject it
      const res = await categoriesApi(alice)[':id'].$put({ param: { id: String(categoryId) }, json })

      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error })
      const list = await categoriesApi(alice).$get()
      expect(await list.json()).toEqual([expect.objectContaining({ id: categoryId, name: 'Test category A' })])
    })
  })

  describe('DELETE /api/finances/categories/:id', () => {
    const transactionCategoryId = async (transactionId: number) => {
      const [row] = await db
        .select({ categoryId: transactions.categoryId })
        .from(transactions)
        .where(eq(transactions.id, transactionId))
      return row.categoryId
    }

    it('deletes only the category with the id', async () => {
      const alice = await signedInUser('alice@example.com')
      const categoryId = await insertCategory(alice.id, 'Test category A')
      const otherId = await insertCategory(alice.id, 'Test category B')

      const res = await categoriesApi(alice)[':id'].$delete({ param: { id: String(categoryId) } })

      expect(res.status).toBe(204)
      const list = await categoriesApi(alice).$get()
      expect(await list.json()).toEqual([expect.objectContaining({ id: otherId })])
    })

    it('removes the deleted category from its own transactions only', async () => {
      const alice = await signedInUser('alice@example.com')
      const categoryId = await insertCategory(alice.id, 'Test category A')
      const otherId = await insertCategory(alice.id, 'Test category B')
      const transactionId = await insertTransaction(alice.id, '2026-09-27T01:30:00.000Z', { categoryId })
      const otherTransactionId = await insertTransaction(alice.id, '2026-09-27T01:30:00.000Z', { categoryId: otherId })

      const res = await categoriesApi(alice)[':id'].$delete({ param: { id: String(categoryId) } })

      expect(res.status).toBe(204)
      expect(await transactionCategoryId(transactionId)).toBeNull()
      expect(await transactionCategoryId(otherTransactionId)).toBe(otherId)
    })

    it('does not find a category of another user and keeps its transactions in it', async () => {
      const alice = await signedInUser('alice@example.com')
      const bob = await signedInUser('bob@example.com')
      const categoryId = await insertCategory(bob.id, 'Test category A')
      const transactionId = await insertTransaction(bob.id, '2026-09-27T01:30:00.000Z', { categoryId })

      const res = await categoriesApi(alice)[':id'].$delete({ param: { id: String(categoryId) } })

      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'Not found' })
      const list = await categoriesApi(bob).$get()
      expect(await list.json()).toEqual([expect.objectContaining({ id: categoryId })])
      expect(await transactionCategoryId(transactionId)).toBe(categoryId)
    })

    it('does not find a category that does not exist', async () => {
      const alice = await signedInUser('alice@example.com')

      const res = await categoriesApi(alice)[':id'].$delete({ param: { id: '1' } })

      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'Not found' })
    })

    it.each(malformedIds)('does not find a category for an id written as %s', async (_, write) => {
      const alice = await signedInUser('alice@example.com')
      const categoryId = await insertCategory(alice.id, 'Test category A')

      const res = await categoriesApi(alice)[':id'].$delete({ param: { id: write(categoryId) } })

      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'Not found' })
      const list = await categoriesApi(alice).$get()
      expect(await list.json()).toEqual([expect.objectContaining({ id: categoryId })])
    })
  })

  describe('a request body that is not JSON', () => {
    // jsonValidator is attached to each route on its own, so a route taking a JSON body
    // goes unchecked unless it has a row here
    const routesTakingJson = [
      ['POST', '/api/finances/transactions'],
      ['PUT', '/api/finances/transactions/1'],
      ['POST', '/api/finances/categories'],
      ['PUT', '/api/finances/categories/1'],
    ]

    // Sent without the typed client, so that each route needs only a method and a path in the table
    const sendBody = async (method: string, path: string, init: { headers?: Record<string, string>, body: string }) => {
      const alice = await signedInUser('alice@example.com')
      return app.request(path, {
        method,
        headers: { Origin: 'http://localhost', Cookie: `${SESSION_COOKIE}=${alice.session}`, ...init.headers },
        body: init.body,
      }, env)
    }

    it.each(routesTakingJson)('%s %s rejects a body that is not valid JSON', async (method, path) => {
      const res = await sendBody(method, path, { headers: { 'Content-Type': 'application/json' }, body: '{"test":' })

      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'The body must be valid JSON' })
    })

    it.each(routesTakingJson)('%s %s rejects a body sent without the JSON Content-Type', async (method, path) => {
      // Without a Content-Type header, a string body is sent as text/plain
      const res = await sendBody(method, path, { body: '{}' })

      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'Content-Type must be application/json' })
    })
  })
})
