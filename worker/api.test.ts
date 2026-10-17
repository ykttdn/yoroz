import { describe, expect, it } from 'vitest'

import { ANOTHER_USER_ERROR, EXPECTED_USER_HEADER } from './session'
import { client, now, signedSession } from './test/helpers'

describe('/api', () => {
  describe('with an invalid session', () => {
    it('rejects a request without a session cookie', async () => {
      const res = await client().api.me.$get()

      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'Unauthorized' })
    })

    it('rejects a token that is not a JWT', async () => {
      const res = await client({ session: 'not-a-jwt' }).api.me.$get()

      expect(res.status).toBe(401)
    })

    it('rejects a token signed with another secret', async () => {
      const res = await client({ session: await signedSession({}, 'another-secret') }).api.me.$get()

      expect(res.status).toBe(401)
    })

    it('rejects a token whose payload was altered', async () => {
      const [header, , signature] = (await signedSession()).split('.')
      const [, payload] = (await signedSession({ email: 'bob@example.com', name: 'Bob' })).split('.')

      const res = await client({ session: `${header}.${payload}.${signature}` }).api.me.$get()

      expect(res.status).toBe(401)
    })

    it('rejects an expired token', async () => {
      const res = await client({ session: await signedSession({ exp: now() - 1 }) }).api.me.$get()

      expect(res.status).toBe(401)
    })

    it('rejects a token without an email', async () => {
      const res = await client({ session: await signedSession({ email: undefined }) }).api.me.$get()

      expect(res.status).toBe(401)
    })

    it('rejects a token whose email is no longer allowed', async () => {
      const res = await client({ session: await signedSession({ email: 'carol@example.com' }) }).api.me.$get()

      expect(res.status).toBe(401)
    })
  })

  describe('with the user the SPA expects', () => {
    it('accepts a request from the expected user', async () => {
      const res = await client({ session: await signedSession() }).api.me.$get(undefined, { headers: { [EXPECTED_USER_HEADER]: '1' } })

      expect(res.status).toBe(200)
    })

    it('rejects a request once another user has signed in', async () => {
      const res = await client({ session: await signedSession({ sub: '2' }) }).api.me.$get(undefined, { headers: { [EXPECTED_USER_HEADER]: '1' } })

      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({ error: ANOTHER_USER_ERROR })
    })

    it('reports an invalid session as unauthorized even with the expected user', async () => {
      const res = await client().api.me.$get(undefined, { headers: { [EXPECTED_USER_HEADER]: '1' } })

      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/me', () => {
    it('returns the signed-in user', async () => {
      const res = await client({ session: await signedSession() }).api.me.$get()

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ id: 1, email: 'alice@example.com', name: 'Alice' })
    })
  })
})
