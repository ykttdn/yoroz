import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'

import { isAllowedEmail, SESSION_COOKIE } from './session'
import type { AppEnv } from './types'

const api = new Hono<AppEnv>()

api.use('*', async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE)
  const payload = token && await verify(token, c.env.AUTH_SECRET, 'HS256').catch(() => undefined)
  // Checked on every request so that removing an address from ALLOWED_EMAILS takes effect before the cookie expires
  if (!payload || typeof payload.email !== 'string' || !isAllowedEmail(c.env.ALLOWED_EMAILS, payload.email)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  c.set('user', { sub: String(payload.sub), email: String(payload.email), name: String(payload.name) })
  await next()
})

api.get('/me', (c) => {
  const { email, name } = c.get('user')
  return c.json({ email, name })
})

api.get('/hello', c => c.json({ message: 'Hello from Hono on Workers' }))

export default api
