import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Router } from 'vue-router'

const alice = { email: 'alice@example.com', name: 'Alice' }

// A redirect runs the guard again, and a Response body can only be read once, so each call gets a new one
const stubSignedIn = () => vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json(alice))
const stubSignedOut = () =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({ error: 'Unauthorized' }, { status: 401 }))

describe('navigation guard', () => {
  let router: Router

  // The router is a module-level singleton that remembers the last route, so each test starts from a fresh one
  beforeEach(async () => {
    vi.resetModules()
    router = (await import('./router')).default
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows home to a signed-in user', async () => {
    stubSignedIn()

    await router.push('/')

    expect(router.currentRoute.value.name).toBe('home')
  })

  it('sends a signed-in user away from the login screen', async () => {
    stubSignedIn()

    await router.push('/login')

    expect(router.currentRoute.value.name).toBe('home')
  })

  it('sends a signed-out user to the login screen', async () => {
    stubSignedOut()

    await router.push('/')

    expect(router.currentRoute.value.name).toBe('login')
  })

  it('sends the user to the login screen when the user cannot be fetched', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(null, { status: 500 }))

    await router.push('/')

    expect(router.currentRoute.value.name).toBe('login')
  })

  it('guards an unknown path after redirecting it to home', async () => {
    stubSignedOut()

    await router.push('/no-such-page')

    expect(router.currentRoute.value.name).toBe('login')
  })
})
