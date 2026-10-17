import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { sessionExpired } from '../session'
import AuthenticatedLayout from './AuthenticatedLayout.vue'

// Attached to the document, since showModal() throws for a dialog that is not connected
const mountLayout = () => mount(AuthenticatedLayout, { attachTo: document.body, global: { stubs: { RouterView: true } } })

describe('AuthenticatedLayout', () => {
  afterEach(() => {
    sessionExpired.value = false
    document.body.innerHTML = ''
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
