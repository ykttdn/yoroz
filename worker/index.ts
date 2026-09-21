import { Hono } from 'hono'
import { csrf } from 'hono/csrf'

import api from './api'
import auth from './auth'
import type { AppEnv } from './types'

const app = new Hono<AppEnv>()

// SameSite=Lax doesn't cover /auth/logout, since dropping the cookie doesn't need the request to carry it
app.use('*', csrf())

app.route('/auth', auth)
app.route('/api', api)

export default app
