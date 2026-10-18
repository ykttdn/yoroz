import type { InferResponseType } from 'hono/client'

import type { api } from './api'

export type User = InferResponseType<typeof api.me.$get>

export type Transaction = InferResponseType<typeof api.finances.transactions.$get, 200>[number]
