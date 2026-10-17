import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { currentUser, sessionEnded } from '../session'
import AuthenticatedLayout from './AuthenticatedLayout.vue'

const alice = { id: 1, email: 'alice@example.com', name: 'Alice' }

// Attached to the document, since showModal() throws for a dialog that is not connected
const mountLayout = () => mount(AuthenticatedLayout, { attachTo: document.body, global: { stubs: { RouterView: true } } })

// Clearing the body removes only the DOM, so without this each earlier test's layout would stay mounted and keep its
// visibilitychange listener on the document, and a later test's fetch count would no longer be its own
enableAutoUnmount(afterEach)

describe('AuthenticatedLayout', () => {
  beforeEach(() => {
    currentUser.value = alice
  })

  afterEach(() => {
    vi.restoreAllMocks()
    currentUser.value = null
    sessionEnded.value = null
    document.body.innerHTML = ''
  })

  it('checks the session when the tab is shown again', () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(alice))
    mountLayout()

    document.dispatchEvent(new Event('visibilitychange'))

    expect(fetch).toHaveBeenCalledOnce()
  })

  it('shows the new name when the same account comes back with one', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ ...alice, name: 'Alice Smith' }))
    const wrapper = mountLayout()

    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()

    expect(currentUser.value).toEqual({ ...alice, name: 'Alice Smith' })
    expect(wrapper.get('header').text()).toContain('Alice Smith')
  })

  // Vitest fails the run on an unhandled rejection, so this catches a check that lets a network failure escape
  it('ignores a check that cannot reach the server', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    mountLayout()

    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()

    expect(fetch).toHaveBeenCalledOnce()
    expect(sessionEnded.value).toBeNull()
  })

  it('does not check the session when the tab is hidden', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    const fetch = vi.spyOn(globalThis, 'fetch')
    mountLayout()

    document.dispatchEvent(new Event('visibilitychange'))

    expect(fetch).not.toHaveBeenCalled()
  })

  it('does not check the session again once it has ended', () => {
    sessionEnded.value = 'expired'
    const fetch = vi.spyOn(globalThis, 'fetch')
    mountLayout()

    document.dispatchEvent(new Event('visibilitychange'))

    expect(fetch).not.toHaveBeenCalled()
  })

  it('stops checking the session once unmounted', () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    mountLayout().unmount()

    document.dispatchEvent(new Event('visibilitychange'))

    expect(fetch).not.toHaveBeenCalled()
  })

  it('shows no modal while the session is alive', () => {
    const wrapper = mountLayout()

    expect(wrapper.find('dialog').exists()).toBe(false)
  })

  it('opens a modal linking to the login when the session expires', async () => {
    const wrapper = mountLayout()

    sessionEnded.value = 'expired'
    await nextTick()

    const dialog = wrapper.get<HTMLDialogElement>('dialog')
    expect(dialog.element.open).toBe(true)
    expect(dialog.get('h2').text()).toBe('ログインが必要です')
    expect(dialog.get('a').attributes('href')).toBe('/auth/google')
  })

  it('opens a modal asking for a reload when another account has signed in', async () => {
    const reload = vi.spyOn(location, 'reload').mockImplementation(() => {})
    const wrapper = mountLayout()

    sessionEnded.value = 'switched'
    await nextTick()

    const dialog = wrapper.get<HTMLDialogElement>('dialog')
    expect(dialog.element.open).toBe(true)
    expect(dialog.get('h2').text()).toBe('別のアカウントでログインされました')
    await dialog.get('button').trigger('click')
    expect(reload).toHaveBeenCalledOnce()
  })

  it('keeps the modal open on Escape', async () => {
    const wrapper = mountLayout()
    sessionEnded.value = 'expired'
    await nextTick()

    const dialog = wrapper.get<HTMLDialogElement>('dialog')
    const cancel = new Event('cancel', { cancelable: true })
    dialog.element.dispatchEvent(cancel)

    expect(cancel.defaultPrevented).toBe(true)
  })

  it('reopens the modal when the browser closes it anyway', async () => {
    const wrapper = mountLayout()
    sessionEnded.value = 'expired'
    await nextTick()

    const dialog = wrapper.get<HTMLDialogElement>('dialog')
    dialog.element.close()
    dialog.element.dispatchEvent(new Event('close'))

    expect(dialog.element.open).toBe(true)
  })
})
