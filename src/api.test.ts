import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ANOTHER_USER_ERROR, EXPECTED_USER_HEADER } from '../worker/session'
import { api } from './api'
import { currentUser, sessionEnded } from './session'

const alice = { id: 1, email: 'alice@example.com', name: 'Alice' }

const sentHeaders = (fetch: MockInstance<typeof globalThis.fetch>) => new Headers(fetch.mock.calls[0][1]?.headers)

describe('api', () => {
  beforeEach(() => {
    currentUser.value = alice
  })

  afterEach(() => {
    vi.restoreAllMocks()
    sessionEnded.value = null
  })

  it('flags the session as expired when a signed-in request is unauthorized', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'Unauthorized' }, { status: 401 }))

    await api.finances.transactions.$get({ query: { month: '2026-10' } })

    expect(sessionEnded.value).toBe('expired')
    expect(currentUser.value).toEqual(alice)
  })

  it('leaves the session alone when no one has signed in yet', async () => {
    currentUser.value = null
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'Unauthorized' }, { status: 401 }))

    await api.me.$get()

    expect(sessionEnded.value).toBeNull()
  })

  it('flags the session as switched when the Worker reports another user', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: ANOTHER_USER_ERROR }, { status: 409 }))

    const res = await api.finances.transactions.$get({ query: { month: '2026-10' } })

    expect(sessionEnded.value).toBe('switched')
    expect(await res.json()).toEqual({ error: ANOTHER_USER_ERROR })
  })

  it('leaves the session alone on any other conflict', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'Already exists' }, { status: 409 }))

    await api.finances.transactions.$get({ query: { month: '2026-10' } })

    expect(sessionEnded.value).toBeNull()
  })

  it('names the signed-in user to the Worker', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json([]))

    await api.finances.transactions.$get({ query: { month: '2026-10' } })

    expect(sentHeaders(fetch).get(EXPECTED_USER_HEADER)).toBe('1')
  })

  it('names no user before sign-in', async () => {
    currentUser.value = null
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(alice))

    await api.me.$get()

    expect(sentHeaders(fetch).has(EXPECTED_USER_HEADER)).toBe(false)
  })

  it.each([200, 500])('leaves the session alone on a %i response', async (status) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json([], { status }))

    await api.finances.transactions.$get({ query: { month: '2026-10' } })

    expect(sessionEnded.value).toBeNull()
  })
})
