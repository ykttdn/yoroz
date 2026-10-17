import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from './api'
import { currentUser, sessionExpired } from './session'

const alice = { email: 'alice@example.com', name: 'Alice' }

describe('api', () => {
  beforeEach(() => {
    currentUser.value = alice
  })

  afterEach(() => {
    vi.restoreAllMocks()
    sessionExpired.value = false
  })

  it('flags the session as expired when a signed-in request is unauthorized', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'Unauthorized' }, { status: 401 }))

    await api.finances.transactions.$get({ query: { month: '2026-10' } })

    expect(sessionExpired.value).toBe(true)
    expect(currentUser.value).toEqual(alice)
  })

  it('leaves the session alone when no one has signed in yet', async () => {
    currentUser.value = null
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'Unauthorized' }, { status: 401 }))

    await api.me.$get()

    expect(sessionExpired.value).toBe(false)
  })

  it.each([200, 500])('leaves the session alone on a %i response', async (status) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json([], { status }))

    await api.finances.transactions.$get({ query: { month: '2026-10' } })

    expect(sessionExpired.value).toBe(false)
  })
})
