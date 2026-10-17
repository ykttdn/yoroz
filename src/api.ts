import { hc } from 'hono/client'

import type { Api } from '../worker/api'
import { currentUser, sessionExpired } from './session'

export const api = hc<Api>('/api', {
  // The Worker authenticates every endpoint on its own, so its 401 is how a session that ended elsewhere is noticed
  fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await fetch(input, init)
    // Only a signed-in user's 401 means the session ended; before sign-in it is the guard's /api/me, which sends the user to log in itself
    if (res.status === 401 && currentUser.value) {
      sessionExpired.value = true
    }
    return res
  },
})
