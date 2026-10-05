import { drizzle } from 'drizzle-orm/d1'
import { Hono } from 'hono'

import type { AppEnv } from '../types'
import { createTransaction, listTransactions, updateTransaction } from './repository'
import { idParamValidator, jsonValidator, monthQueryValidator, transactionBodyValidator } from './validators'

const finances = new Hono<AppEnv>()
  .get('/transactions', monthQueryValidator, async (c) => {
    const transactions = await listTransactions(drizzle(c.env.DB), c.get('user').id, c.req.valid('query').month)
    return c.json(transactions)
  })
  .post('/transactions', jsonValidator, transactionBodyValidator, async (c) => {
    const transaction = await createTransaction(drizzle(c.env.DB), c.get('user').id, c.req.valid('json'))
    return c.json(transaction, 201)
  })
  .put('/transactions/:id', idParamValidator, jsonValidator, transactionBodyValidator, async (c) => {
    const transaction = await updateTransaction(drizzle(c.env.DB), c.get('user').id, c.req.valid('param').id, c.req.valid('json'))
    if (!transaction) {
      return c.json({ error: 'Not found' }, 404)
    }
    return c.json(transaction)
  })

export default finances
