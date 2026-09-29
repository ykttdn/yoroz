import { googleAuth } from '@hono/oauth-providers/google'
import { drizzle } from 'drizzle-orm/d1'
import { Hono } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'
import { sign } from 'hono/jwt'

import { users } from './db/schema'
import { isAllowedEmail, SESSION_COOKIE, SESSION_MAX_AGE } from './session'
import type { AppEnv } from './types'

const auth = new Hono<AppEnv>()

// The OAuth callback is a page the browser navigates to, so a bare 500 would leave the user stranded there
auth.onError((e, c) => {
  console.error('Sign-in failed', e)
  return c.redirect('/login?error=failed')
})

// Without this, cancelling on Google's consent screen would bounce straight back to Google,
// because googleAuth starts a new flow whenever the callback has no code
auth.get('/google', async (c, next) => {
  if (c.req.query('error')) {
    return c.redirect('/login?error=cancelled')
  }
  await next()
})

auth.get(
  '/google',
  (c, next) => googleAuth({
    client_id: c.env.GOOGLE_CLIENT_ID,
    client_secret: c.env.GOOGLE_CLIENT_SECRET,
    scope: ['openid', 'email', 'profile'],
    // Otherwise being signed in to a non-allowed account is a dead end
    prompt: 'select_account',
  })(c, next),
  async (c) => {
    const googleUser = c.get('user-google')
    if (!googleUser?.id || !googleUser.email || !googleUser.verified_email || !isAllowedEmail(c.env.ALLOWED_EMAILS, googleUser.email)) {
      // Otherwise an existing session survives, and the SPA sends the user home without showing the error
      deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true })
      return c.redirect('/login?error=forbidden')
    }

    const name = googleUser.name ?? ''
    const db = drizzle(c.env.DB)
    // The Google account is identified by its ID, since the email and name can change on Google's side
    const [user] = await db.insert(users)
      .values({ googleSub: googleUser.id, email: googleUser.email, name })
      .onConflictDoUpdate({ target: users.googleSub, set: { email: googleUser.email, name } })
      .returning({ id: users.id })

    const token = await sign(
      // JWT expects sub to be a string
      { sub: String(user.id), email: googleUser.email, name, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE },
      c.env.AUTH_SECRET,
      'HS256',
    )
    setCookie(c, SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: SESSION_MAX_AGE })
    return c.redirect('/')
  },
)

auth.post('/logout', (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true })
  return c.redirect('/login', 303)
})

export default auth
