import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'
import type { Logger } from 'drizzle-orm/logger'

import { logWithTime } from './logWithTime'

// Colors the SQL magenta
const queryLogger: Logger = {
  logQuery: (query, params) => logWithTime(`Query: \x1b[35m${query}\x1b[0m -- params: ${JSON.stringify(params)}`),
}

export const db = drizzle(env.DB, { logger: import.meta.env.MODE === 'development' && queryLogger })
