import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'
import { verify } from 'hono/jwt'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import { users } from './db/schema'
import app from './index'
import { SESSION_COOKIE, SESSION_MAX_AGE } from './session'

const db = drizzle(env.DB)

const googleUser = {
  id: 'google-id',
  email: 'alice@example.com',
  verified_email: true,
  name: 'Alice',
}

// Answers the requests googleAuth sends to Google on a callback.
// By default the allowed googleUser signs in; `token` and `user` override parts of the responses to make it fail.
const stubGoogle = ({ token = {}, user = {} }: { token?: Record<string, unknown>, user?: Record<string, unknown> } = {}) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = input instanceof Request ? input.url : input.toString()
    // Called first, to exchange the `code` in the callback for a token
    if (url === 'https://oauth2.googleapis.com/token') {
      return Response.json({ access_token: 'access-token', expires_in: 3600, scope: 'openid email profile', ...token })
    }
    // Called once the token is issued, to fetch the user who signed in
    if (url === 'https://www.googleapis.com/oauth2/v2/userinfo') {
      return Response.json({ ...googleUser, ...user })
    }
    throw new Error(`Unexpected fetch: ${url}`)
  })

// Google redirects back with a `code`, which googleAuth exchanges for a token, and the `state` googleAuth sent,
// which proves the redirect belongs to a sign-in this browser started.
// googleAuth only treats a request with a `code` as a callback, and rejects it unless its state matches the cookie set before redirecting to Google
const callback = ({ session }: { session?: string } = {}) => {
  const cookie = session === undefined ? 'state=state' : `state=state; ${SESSION_COOKIE}=${session}`
  return app.request('/auth/google?code=code&state=state', { headers: { Cookie: cookie } }, env)
}

const jwtPayload = (res: Response) => {
  const token = res.headers.getSetCookie().find(c => c.startsWith(`${SESSION_COOKIE}=`))!.split(';')[0].split('=')[1]
  return verify(token, env.AUTH_SECRET, 'HS256')
}

describe('/auth', () => {
  beforeEach(async () => {
    await db.delete(users)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET /auth/google', () => {
    it('lets the user choose which Google account to sign in with', async () => {
      const res = await app.request('/auth/google', {}, env)

      const location = new URL(res.headers.get('Location')!)
      expect(location.searchParams.get('prompt')).toBe('select_account')
    })

    it('redirects an allowed user home', async () => {
      stubGoogle()

      const res = await callback()

      expect(res.headers.get('Location')).toBe('/')
    })

    it('sets a session cookie', async () => {
      stubGoogle()

      const res = await callback()

      const cookie = res.headers.getSetCookie().find(c => c.startsWith(`${SESSION_COOKIE}=`))
      // Keeps the token away from scripts, so an XSS cannot steal it
      expect(cookie).toContain('HttpOnly')
      // Keeps other sites from sending it with their requests
      expect(cookie).toContain('SameSite=Lax')
      // Never sent over plain HTTP
      expect(cookie).toContain('Secure')
      // Expires together with the token inside it
      expect(cookie).toContain(`Max-Age=${SESSION_MAX_AGE}`)
      // The session is checked on /api, so the cookie must be sent there, not only to /auth where it was set
      expect(cookie).toMatch(/; Path=\/(;|$)/)
    })

    it('creates a user on the first sign-in', async () => {
      const now = new Date('2026-01-01T00:00:00Z')
      vi.setSystemTime(now)
      onTestFinished(() => {
        vi.useRealTimers()
      })
      stubGoogle()

      await callback()

      expect(await db.select().from(users)).toEqual([{
        id: expect.any(Number),
        googleSub: googleUser.id,
        email: googleUser.email,
        name: googleUser.name,
        createdAt: now,
        updatedAt: now,
      }])
    })

    it('updates the user instead of creating another on a later sign-in', async () => {
      const firstSignIn = new Date('2026-01-01T00:00:00Z')
      const laterSignIn = new Date('2026-02-01T00:00:00Z')
      onTestFinished(() => {
        vi.useRealTimers()
      })
      vi.setSystemTime(firstSignIn)
      stubGoogle()
      await callback()
      const [created] = await db.select().from(users)

      vi.setSystemTime(laterSignIn)
      stubGoogle({ user: { email: 'bob@example.com', name: 'Bob' } })
      await callback()

      expect(await db.select().from(users)).toEqual([{
        id: created.id,
        googleSub: googleUser.id,
        email: 'bob@example.com',
        name: 'Bob',
        createdAt: firstSignIn,
        updatedAt: laterSignIn,
      }])
    })

    it('puts the user into a session signed with AUTH_SECRET', async () => {
      const now = new Date('2026-01-01T00:00:00Z')
      vi.setSystemTime(now)
      onTestFinished(() => {
        vi.useRealTimers()
      })
      stubGoogle()

      const res = await callback()

      const [user] = await db.select().from(users)
      expect(await jwtPayload(res)).toEqual({
        sub: String(user.id),
        email: googleUser.email,
        name: googleUser.name,
        exp: now.getTime() / 1000 + SESSION_MAX_AGE,
      })
    })

    it('uses an empty name when Google omits the name', async () => {
      stubGoogle({ user: { name: undefined } })

      const res = await callback()

      expect((await jwtPayload(res)).name).toBe('')
      const [user] = await db.select().from(users)
      expect(user.name).toBe('')
    })

    it('redirects to the login page when the user cancels on Google', async () => {
      const res = await app.request('/auth/google?error=access_denied', {}, env)

      expect(res.headers.get('Location')).toBe('/login?error=cancelled')
    })

    it('redirects to the login page and logs why when Google sign-in fails', async () => {
      stubGoogle({ token: { error: 'invalid_grant' } })
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      const res = await callback()

      expect(res.headers.get('Location')).toBe('/login?error=failed')
      expect(consoleError).toHaveBeenCalled()
    })

    it('forbids a user whose email is not allowed and drops the existing session', async () => {
      stubGoogle({ user: { email: 'carol@example.com' } })

      const res = await callback({ session: 'existing-session' })

      expect(res.headers.get('Location')).toBe('/login?error=forbidden')
      expect(res.headers.get('Set-Cookie')).toContain(`${SESSION_COOKIE}=; Max-Age=0;`)
      expect(await db.select().from(users)).toEqual([])
    })

    it('forbids a user whose email is not verified and drops the existing session', async () => {
      stubGoogle({ user: { verified_email: false } })

      const res = await callback({ session: 'existing-session' })

      expect(res.headers.get('Location')).toBe('/login?error=forbidden')
      expect(res.headers.get('Set-Cookie')).toContain(`${SESSION_COOKIE}=; Max-Age=0;`)
      expect(await db.select().from(users)).toEqual([])
    })

    it('forbids a user without an email and drops the existing session', async () => {
      stubGoogle({ user: { email: undefined } })

      const res = await callback({ session: 'existing-session' })

      expect(res.headers.get('Location')).toBe('/login?error=forbidden')
      expect(res.headers.get('Set-Cookie')).toContain(`${SESSION_COOKIE}=; Max-Age=0;`)
      expect(await db.select().from(users)).toEqual([])
    })
  })

  describe('POST /auth/logout', () => {
    it('drops the session and redirects to the login page', async () => {
      const res = await app.request(
        '/auth/logout',
        { method: 'POST', headers: { 'Origin': 'http://localhost', 'Content-Type': 'application/x-www-form-urlencoded' } },
        env,
      )

      expect(res.status).toBe(303)
      expect(res.headers.get('Location')).toBe('/login')
      expect(res.headers.get('Set-Cookie')).toContain(`${SESSION_COOKIE}=; Max-Age=0;`)
    })

    it('keeps the session when another site posts a form to it', async () => {
      const res = await app.request(
        '/auth/logout',
        { method: 'POST', headers: { 'Origin': 'https://evil.example.com', 'Content-Type': 'application/x-www-form-urlencoded' } },
        env,
      )

      expect(res.headers.get('Set-Cookie')).toBeNull()
    })
  })
})
