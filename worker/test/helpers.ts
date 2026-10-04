import { env } from 'cloudflare:workers'
import { sign } from 'hono/jwt'
import { testClient } from 'hono/testing'

import app from '../index'
import { SESSION_COOKIE } from '../session'

export const now = () => Math.floor(Date.now() / 1000)

export const signedSession = (payload: Record<string, unknown> = {}, secret = env.AUTH_SECRET) =>
  sign({ sub: '1', email: 'alice@example.com', name: 'Alice', exp: now() + 60, ...payload }, secret, 'HS256')

// Sends Origin as a browser does, since the CSRF check requires it of a request without a JSON Content-Type
export const client = ({ session }: { session?: string } = {}) =>
  testClient(app, env, undefined, {
    headers: {
      Origin: 'http://localhost',
      ...(session === undefined ? {} : { Cookie: `${SESSION_COOKIE}=${session}` }),
    },
  })
