import { hc } from 'hono/client'

import type { Api } from '../worker/api'
import { ANOTHER_USER_ERROR, EXPECTED_USER_HEADER } from '../worker/session'
import { currentUser, sessionEnded } from './session'

// Keeps the status of a failed response, so a caller can tell a status it handles, such as a 404, from other failures
export class ResponseError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export const isNotFound = (error: unknown) => error instanceof ResponseError && error.status === 404

export const api = hc<Api>('/api', {
  fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    // Without this, the Worker would let this page's requests act as whichever account signed in last
    if (currentUser.value) {
      headers.set(EXPECTED_USER_HEADER, String(currentUser.value.id))
    }
    const res = await fetch(input, { ...init, headers })

    // Without the checks below, a session that ended or changed elsewhere would go unnoticed until a reload, since the
    // Worker reports it only as a 401 or 409 on the next request

    // Only a signed-in user's 401 means the session ended; before sign-in it is the guard's /api/me, which sends the user to log in itself
    if (res.status === 401 && currentUser.value) {
      sessionEnded.value = 'expired'
    }
    // Checking the status alone would take a 409 an endpoint returns for a conflict of its own as another account signing
    // in. Reading the response itself would use up its body, and the caller's res.json() would throw
    if (res.status === 409 && (await res.clone().json().catch(() => null))?.error === ANOTHER_USER_ERROR) {
      sessionEnded.value = 'switched'
    }
    return res
  },
})
