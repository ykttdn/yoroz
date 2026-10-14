import { zValidator } from '@hono/zod-validator'
import { createMiddleware } from 'hono/factory'
import { validator } from 'hono/validator'
import { z } from 'zod'

import { transactions } from '../db/schema'
import { isInYearRange, isMinuteTimestamp, MAX_YEAR, MIN_YEAR, monthRange } from './datetime'

export const monthQueryValidator = validator('query', (value, c) => {
  const range = typeof value.month === 'string' ? monthRange(value.month) : undefined
  if (!range) {
    return c.json({ error: `month must be a YYYY-MM month from ${MIN_YEAR}-01 to ${MAX_YEAR}-12` }, 400)
  }
  return { month: range }
})

export const idParamValidator = validator('param', (value, c) => {
  const id = /^[1-9]\d*$/.test(value.id) ? Number(value.id) : NaN
  if (!Number.isSafeInteger(id)) {
    return c.json({ error: 'Not found' }, 404)
  }
  return { id }
})

// Otherwise zValidator validates {} when the Content-Type isn't JSON, and throws a plain-text 400 when the body isn't valid JSON.
export const jsonValidator = createMiddleware(async (c, next) => {
  if (!/^application\/json(;|$)/i.test(c.req.header('Content-Type') ?? '')) {
    return c.json({ error: 'Content-Type must be application/json' }, 400)
  }
  try {
    await c.req.json()
  } catch {
    return c.json({ error: 'The body must be valid JSON' }, 400)
  }
  await next()
})

const OCCURRED_AT_FORMAT_ERROR = 'occurredAt must be a UTC timestamp on the minute'
const OCCURRED_AT_YEAR_ERROR = `occurredAt must be in the years ${MIN_YEAR} to ${MAX_YEAR} in Japan time`
const MAX_AMOUNT = 1_000_000
const AMOUNT_ERROR = `amount must be an integer from 1 to ${MAX_AMOUNT}`
const MAX_MEMO_LENGTH = 200

export const transactionBodyValidator = zValidator('json',
  z.object({
    occurredAt: z.string({ error: OCCURRED_AT_FORMAT_ERROR })
      .refine(isMinuteTimestamp, { error: OCCURRED_AT_FORMAT_ERROR, abort: true })
      .refine(isInYearRange, { error: OCCURRED_AT_YEAR_ERROR })
      .transform(value => new Date(value)),
    kind: z.enum(transactions.kind.enumValues, { error: 'kind must be expense or income' }),
    amount: z.int({ error: AMOUNT_ERROR }).positive({ error: AMOUNT_ERROR }).max(MAX_AMOUNT, { error: AMOUNT_ERROR }),
    memo: z.string({ error: 'memo must be a string' }).max(MAX_MEMO_LENGTH, { error: `memo must be at most ${MAX_MEMO_LENGTH} characters` }).default(''),
  },
  { error: 'The body must be a JSON object' }),
  (result, c) => {
    if (!result.success) {
      return c.json({ error: result.error.issues[0].message }, 400)
    }
  },
)
