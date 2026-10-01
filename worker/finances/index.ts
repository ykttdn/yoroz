import { drizzle } from 'drizzle-orm/d1'
import { Hono } from 'hono'

import type { AppEnv } from '../types'
import { listTransactions } from './repository'
import { monthQueryValidator } from './validators'

const finances = new Hono<AppEnv>()
  .get('/transactions', monthQueryValidator, async (c) => {
    const transactions = await listTransactions(drizzle(c.env.DB), c.get('user').id, c.req.valid('query').month)
    return c.json(transactions)
  })

export default finances
