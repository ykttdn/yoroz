import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'

import finances from './finances'
import { ANOTHER_USER_ERROR, EXPECTED_USER_HEADER, isAllowedEmail, SESSION_COOKIE } from './session'
import type { AppEnv } from './types'

const api = new Hono<AppEnv>()
  .use('*', async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE)
    const payload = token && await verify(token, c.env.AUTH_SECRET, 'HS256').catch(() => undefined)
    // Checked on every request so that removing an address from ALLOWED_EMAILS takes effect before the cookie expires
    if (!payload || typeof payload.email !== 'string' || !isAllowedEmail(c.env.ALLOWED_EMAILS, payload.email)) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    // Without this, a tab left on one account would act as another that signed in elsewhere and save entries to its data.
    // A request without the header is let through, since refusing it would fail the SPA's first /api/me, which goes out
    // before it knows who is signed in. The user still comes from the signed cookie: taking it from this header would let
    // a forged one act as anyone
    const expectedUser = c.req.header(EXPECTED_USER_HEADER)
    if (expectedUser !== undefined && expectedUser !== payload.sub) {
      return c.json({ error: ANOTHER_USER_ERROR }, 409)
    }

    c.set('user', { id: Number(payload.sub), email: String(payload.email), name: String(payload.name) })
    await next()
  })
  .get('/me', (c) => {
    const { id, email, name } = c.get('user')
    return c.json({ id, email, name })
  })
  .route('/finances', finances)

export type Api = typeof api

export default api
