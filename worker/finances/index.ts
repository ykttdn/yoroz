import { drizzle } from 'drizzle-orm/d1'
import { Hono } from 'hono'

import type { AppEnv } from '../types'
import { createTransaction, listTransactions } from './repository'
import { jsonValidator, monthQueryValidator, transactionBodyValidator } from './validators'

const finances = new Hono<AppEnv>()
  .get('/transactions', monthQueryValidator, async (c) => {
    const transactions = await listTransactions(drizzle(c.env.DB), c.get('user').id, c.req.valid('query').month)
    return c.json(transactions)
  })
  .post('/transactions', jsonValidator, transactionBodyValidator, async (c) => {
    const transaction = await createTransaction(drizzle(c.env.DB), c.get('user').id, c.req.valid('json'))
    return c.json(transaction, 201)
  })

export default finances
