import { validator } from 'hono/validator'

import { monthRange } from './datetime'

export const monthQueryValidator = validator('query', (value, c) => {
  const range = typeof value.month === 'string' ? monthRange(value.month) : undefined
  if (!range) {
    return c.json({ error: 'month must be a YYYY-MM month' }, 400)
  }
  return { month: range }
})
