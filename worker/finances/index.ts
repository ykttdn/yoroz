import { Hono } from 'hono'

import { db } from '../db'
import type { AppEnv } from '../types'
import { createTransaction, deleteTransaction, listTransactions, updateTransaction } from './repository'
import { idParamValidator, jsonValidator, monthQueryValidator, transactionBodyValidator } from './validators'

const finances = new Hono<AppEnv>()
  .get('/transactions', monthQueryValidator, async (c) => {
    const transactions = await listTransactions(db, c.get('user').id, c.req.valid('query').month)
    return c.json(transactions)
  })
  .post('/transactions', jsonValidator, transactionBodyValidator, async (c) => {
    const transaction = await createTransaction(db, c.get('user').id, c.req.valid('json'))
    return c.json(transaction, 201)
  })
  .put('/transactions/:id', idParamValidator, jsonValidator, transactionBodyValidator, async (c) => {
    const transaction = await updateTransaction(db, c.get('user').id, c.req.valid('param').id, c.req.valid('json'))
    if (!transaction) {
      return c.json({ error: 'Not found' }, 404)
    }
    return c.json(transaction)
  })
  .delete('/transactions/:id', idParamValidator, async (c) => {
    const deleted = await deleteTransaction(db, c.get('user').id, c.req.valid('param').id)
    if (!deleted) {
      return c.json({ error: 'Not found' }, 404)
    }
    return c.body(null, 204)
  })

export default finances
