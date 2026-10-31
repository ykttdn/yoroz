import { VueQueryPlugin } from '@tanstack/vue-query'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createQueryClient } from '../queryClient'
import { pressEscape } from '../test/helpers'
import type { Transaction } from '../types'
import DeleteTransactionModal from './DeleteTransactionModal.vue'

const transactionToDelete: Transaction = { id: 9, occurredAt: '2026-08-31T15:00:00.000Z', kind: 'expense', amount: 9999, memo: 'テストメモ' }

const mountDeleteTransactionModal = () =>
  mount(DeleteTransactionModal, {
    props: { transaction: transactionToDelete },
    attachTo: document.body,
    global: { plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]] },
  })

enableAutoUnmount(afterEach)

describe('DeleteTransactionModal', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('deletes the transaction and closes', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
    const wrapper = mountDeleteTransactionModal()

    await wrapper.findAll('button').find(button => button.text() === '削除')!.trigger('click')
    await flushPromises()

    const [url, init] = fetchSpy.mock.calls[0]
    expect(String(url)).toMatch(/\/api\/finances\/transactions\/9$/)
    expect(init?.method).toBe('DELETE')
    expect(wrapper.get<HTMLDialogElement>('dialog').element.open).toBe(false)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('stays open with an error when the transaction cannot be deleted', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }))
    const wrapper = mountDeleteTransactionModal()

    await wrapper.findAll('button').find(button => button.text() === '削除')!.trigger('click')
    await flushPromises()

    expect(wrapper.get<HTMLDialogElement>('dialog').element.open).toBe(true)
    expect(wrapper.get('[role="alert"]').text()).toBe('削除できませんでした。')
  })

  it('stays open saying so when the transaction was already deleted', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 404 }))
    const wrapper = mountDeleteTransactionModal()

    await wrapper.findAll('button').find(button => button.text() === '削除')!.trigger('click')
    await flushPromises()

    expect(wrapper.get<HTMLDialogElement>('dialog').element.open).toBe(true)
    expect(wrapper.get('[role="alert"]').text()).toBe('この明細はすでに削除されています。')
  })

  it('keeps Escape from closing the modal while the request is pending', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}))
    const wrapper = mountDeleteTransactionModal()

    await wrapper.findAll('button').find(button => button.text() === '削除')!.trigger('click')
    await flushPromises()

    expect(pressEscape(wrapper.get('dialog').element)).toEqual({ keydownPrevented: true, cancelPrevented: true })
  })

  it('closes without sending anything when cancelled', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const wrapper = mountDeleteTransactionModal()

    await wrapper.findAll('button').find(button => button.text() === 'キャンセル')!.trigger('click')

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(wrapper.get<HTMLDialogElement>('dialog').element.open).toBe(false)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
