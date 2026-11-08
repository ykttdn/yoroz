import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { logger } from 'hono/logger'

import api from './api'
import auth from './auth'
import { logWithTime } from './logWithTime'
import type { AppEnv } from './types'

const BOLD = '\x1b[1m'
const CYAN = '\x1b[36m'
const RESET = '\x1b[0m'

const highlightMethodAndPath = (line: string) =>
  line.replace(/^(<--|-->) (\S+) (\S+)/, `$1 ${BOLD}$2${RESET} ${CYAN}$3${RESET}`)

const requestLogger = logger(line => logWithTime(highlightMethodAndPath(line)))

const app = new Hono<AppEnv>()
  .use('*', import.meta.env.MODE === 'development' ? requestLogger : (_, next) => next())
  // SameSite=Lax doesn't cover /auth/logout, since dropping the cookie doesn't need the request to carry it
  .use('*', csrf())
  .route('/auth', auth)
  .route('/api', api)

export default app
