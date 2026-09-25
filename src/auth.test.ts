import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { currentUser, fetchUser } from './auth'

const alice = { email: 'alice@example.com', name: 'Alice' }

describe('fetchUser', () => {
  beforeEach(() => {
    currentUser.value = null
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

  it('throws on a server error and clears the previous user', async () => {
    currentUser.value = alice
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }))

    await expect(fetchUser()).rejects.toThrow('500')
    expect(currentUser.value).toBeNull()
  })

  it('throws when the request fails and clears the previous user', async () => {
    currentUser.value = alice
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(fetchUser()).rejects.toThrow('Failed to fetch')
    expect(currentUser.value).toBeNull()
  })
})
