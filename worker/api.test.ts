import { env } from 'cloudflare:workers'
import { sign } from 'hono/jwt'
import { describe, expect, it } from 'vitest'

import app from './index'
import { SESSION_COOKIE } from './session'

const now = () => Math.floor(Date.now() / 1000)

const signedSession = (payload: Record<string, unknown> = {}, secret = env.AUTH_SECRET) =>
  sign({ sub: 'google-id', email: 'alice@example.com', name: 'Alice', exp: now() + 60, ...payload }, secret, 'HS256')

const request = (path: string, { session }: { session?: string } = {}) =>
  app.request(path, session === undefined ? {} : { headers: { Cookie: `${SESSION_COOKIE}=${session}` } }, env)

describe('/api', () => {
  describe('with an invalid session', () => {
    it('rejects a request without a session cookie', async () => {
      const res = await request('/api/me')

      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'Unauthorized' })
    })

    it('rejects a token that is not a JWT', async () => {
      const res = await request('/api/me', { session: 'not-a-jwt' })

      expect(res.status).toBe(401)
    })

    it('rejects a token signed with another secret', async () => {
      const res = await request('/api/me', { session: await signedSession({}, 'another-secret') })

      expect(res.status).toBe(401)
    })

    it('rejects a token whose payload was altered', async () => {
      const [header, , signature] = (await signedSession()).split('.')
      const [, payload] = (await signedSession({ email: 'bob@example.com', name: 'Bob' })).split('.')

      const res = await request('/api/me', { session: `${header}.${payload}.${signature}` })

      expect(res.status).toBe(401)
    })

    it('rejects an expired token', async () => {
      const res = await request('/api/me', { session: await signedSession({ exp: now() - 1 }) })

      expect(res.status).toBe(401)
    })

    it('rejects a token without an email', async () => {
      const res = await request('/api/me', { session: await signedSession({ email: undefined }) })

      expect(res.status).toBe(401)
    })

    it('rejects a token whose email is no longer allowed', async () => {
      const res = await request('/api/me', { session: await signedSession({ email: 'carol@example.com' }) })

      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/me', () => {
    it('returns the signed-in user', async () => {
      const res = await request('/api/me', { session: await signedSession() })

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ email: 'alice@example.com', name: 'Alice' })
    })
  })

  describe('GET /api/hello', () => {
    it('returns a message to a signed-in user', async () => {
      const res = await request('/api/hello', { session: await signedSession() })

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ message: 'Hello from Hono on Workers' })
    })
  })
})
