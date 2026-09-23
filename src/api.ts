import { hc } from 'hono/client'

import type { Api } from '../worker/api'

export const api = hc<Api>('/api')
