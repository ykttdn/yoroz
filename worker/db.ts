import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'
import type { Logger } from 'drizzle-orm/logger'

import { MAGENTA, RESET } from './ansi'
import { logWithTime } from './logWithTime'

const queryLogger: Logger = {
  logQuery: (query, params) => logWithTime(`Query: ${MAGENTA}${query}${RESET} -- params: ${JSON.stringify(params)}`),
}

export const db = drizzle(env.DB, { logger: import.meta.env.MODE === 'development' && queryLogger })
