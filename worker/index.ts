import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { logger } from 'hono/logger'

import api from './api'
import auth from './auth'
import type { AppEnv } from './types'

// Makes the method bold and colors the path cyan
const requestLogger = logger(str => console.log(str.replace(/^(<--|-->) (\S+) (\S+)/, '$1 \x1b[1m$2\x1b[0m \x1b[36m$3\x1b[0m')))

const app = new Hono<AppEnv>()
  .use('*', import.meta.env.MODE === 'development' ? requestLogger : (_, next) => next())
  // SameSite=Lax doesn't cover /auth/logout, since dropping the cookie doesn't need the request to carry it
  .use('*', csrf())
  .route('/auth', auth)
  .route('/api', api)

export default app
