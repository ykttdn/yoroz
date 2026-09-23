import type { InferResponseType } from 'hono/client'

import type { api } from './api'

export type User = InferResponseType<typeof api.me.$get>
