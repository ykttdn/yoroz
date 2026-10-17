import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchUser, getCachedOrFetchUser } from './auth'
import { currentUser, sessionEnded } from './session'

const alice = { id: 1, email: 'alice@example.com', name: 'Alice' }

describe('fetchUser', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the signed-in user', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(alice))

    expect(await fetchUser()).toEqual(alice)
  })

  it('returns null when signed out', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'Unauthorized' }, { status: 401 }))

    expect(await fetchUser()).toBeNull()
  })

  it('throws on a server error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }))

    await expect(fetchUser()).rejects.toThrow('500')
  })

  it('throws when the request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(fetchUser()).rejects.toThrow('Failed to fetch')
  })
})

describe('getCachedOrFetchUser', () => {
  beforeEach(() => {
    currentUser.value = null
    sessionEnded.value = null
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the user already fetched without asking again', async () => {
    currentUser.value = alice
    const fetch = vi.spyOn(globalThis, 'fetch')

    expect(await getCachedOrFetchUser()).toEqual(alice)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fetches the user when none is known yet', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(alice))

    expect(await getCachedOrFetchUser()).toEqual(alice)
    expect(currentUser.value).toEqual(alice)
  })

  it('returns null when signed out', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'Unauthorized' }, { status: 401 }))

    expect(await getCachedOrFetchUser()).toBeNull()
    expect(currentUser.value).toBeNull()
  })
})
