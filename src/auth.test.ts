import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchUser, getCachedOrFetchUser } from './auth'
import { currentUser, sessionExpired } from './session'

const alice = { email: 'alice@example.com', name: 'Alice' }

describe('fetchUser', () => {
  beforeEach(() => {
    currentUser.value = null
    sessionExpired.value = false
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the signed-in user and keeps it in currentUser', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(alice))

    expect(await fetchUser()).toEqual(alice)
    expect(currentUser.value).toEqual(alice)
  })

  it('returns null when signed out', async () => {
    currentUser.value = alice
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'Unauthorized' }, { status: 401 }))

    expect(await fetchUser()).toBeNull()
    expect(currentUser.value).toBeNull()
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
    sessionExpired.value = false
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
})
