import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { createMiddleware } from 'hono/factory'
import { logger } from 'hono/logger'

import { BOLD, CYAN, RESET } from './ansi'
import api from './api'
import auth from './auth'
import { logWithTime } from './logWithTime'
import type { AppEnv } from './types'

const highlightMethodAndPath = (line: string) =>
  line.replace(/^(<--|-->) (\S+) (\S+)/, `$1 ${BOLD}$2${RESET} ${CYAN}$3${RESET}`)

const requestLogger = logger(line => logWithTime(highlightMethodAndPath(line)))

const payloadLogger = createMiddleware(async (c, next) => {
  const payload = await c.req.text()
  if (payload) {
    logWithTime(`Payload: ${payload}`)
  }
  await next()
})

const app = new Hono<AppEnv>()
  .use('*', import.meta.env.MODE === 'development' ? requestLogger : (_, next) => next())
  .use('*', import.meta.env.MODE === 'development' ? payloadLogger : (_, next) => next())
  // SameSite=Lax doesn't cover /auth/logout, since dropping the cookie doesn't need the request to carry it
  .use('*', csrf())
  .route('/auth', auth)
  .route('/api', api)

export default app
