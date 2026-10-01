import { env } from 'cloudflare:workers'
import { sign } from 'hono/jwt'
import { testClient } from 'hono/testing'

import app from '../index'
import { SESSION_COOKIE } from '../session'

export const now = () => Math.floor(Date.now() / 1000)

export const signedSession = (payload: Record<string, unknown> = {}, secret = env.AUTH_SECRET) =>
  sign({ sub: '1', email: 'alice@example.com', name: 'Alice', exp: now() + 60, ...payload }, secret, 'HS256')

export const client = ({ session }: { session?: string } = {}) =>
  testClient(app, env, undefined, session === undefined ? {} : { headers: { Cookie: `${SESSION_COOKIE}=${session}` } })
