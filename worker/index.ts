import { Hono } from 'hono'

import api from './api'
import auth from './auth'
import type { AppEnv } from './types'

const app = new Hono<AppEnv>()

app.route('/auth', auth)
app.route('/api', api)

export default app
