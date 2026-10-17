import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { sessionExpired } from '../session'
import AuthenticatedLayout from './AuthenticatedLayout.vue'

// Attached to the document, since showModal() throws for a dialog that is not connected
const mountLayout = () => mount(AuthenticatedLayout, { attachTo: document.body, global: { stubs: { RouterView: true } } })

// Clearing the body removes only the DOM, so without this each earlier test's layout would stay mounted and keep its
// visibilitychange listener on the document, and a later test's fetch count would no longer be its own
enableAutoUnmount(afterEach)

describe('AuthenticatedLayout', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    sessionExpired.value = false
    document.body.innerHTML = ''
  })

  it('checks the session when the tab is shown again', () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({}))
    mountLayout()

    document.dispatchEvent(new Event('visibilitychange'))

    expect(fetch).toHaveBeenCalledOnce()
  })

  // Vitest fails the run on an unhandled rejection, so this catches a check that lets a network failure escape
  it('ignores a check that cannot reach the server', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    mountLayout()

    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()

    expect(fetch).toHaveBeenCalledOnce()
    expect(sessionExpired.value).toBe(false)
  })

  it('does not check the session when the tab is hidden', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    const fetch = vi.spyOn(globalThis, 'fetch')
    mountLayout()

    document.dispatchEvent(new Event('visibilitychange'))

    expect(fetch).not.toHaveBeenCalled()
  })

  it('does not check the session again once it has expired', () => {
    sessionExpired.value = true
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

    sessionExpired.value = true
    await nextTick()

    const dialog = wrapper.get<HTMLDialogElement>('dialog')
    expect(dialog.element.open).toBe(true)
    expect(dialog.get('h2').text()).toBe('ログインが必要です')
    expect(dialog.get('a').attributes('href')).toBe('/auth/google')
  })

  it('keeps the modal open on Escape', async () => {
    const wrapper = mountLayout()
    sessionExpired.value = true
    await nextTick()

    const dialog = wrapper.get<HTMLDialogElement>('dialog')
    const cancel = new Event('cancel', { cancelable: true })
    dialog.element.dispatchEvent(cancel)

    expect(cancel.defaultPrevented).toBe(true)
  })

  it('reopens the modal when the browser closes it anyway', async () => {
    const wrapper = mountLayout()
    sessionExpired.value = true
    await nextTick()

    const dialog = wrapper.get<HTMLDialogElement>('dialog')
    dialog.element.close()
    dialog.element.dispatchEvent(new Event('close'))

    expect(dialog.element.open).toBe(true)
  })
})
