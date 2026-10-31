import { VueQueryPlugin } from '@tanstack/vue-query'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createQueryClient } from '../queryClient'
import { pressEscape } from '../test/helpers'
import type { Transaction } from '../types'
import TransactionModal from './TransactionModal.vue'

const addedTransaction = { id: 1, occurredAt: '2026-08-31T15:00:00.000Z', kind: 'income', amount: 1111, memo: 'テストメモ' }

// 1 a.m. on October 1 in Japan time, while it is still September in UTC
const transactionToEdit: Transaction = { id: 9, occurredAt: '2026-09-30T16:00:00.000Z', kind: 'expense', amount: 9999, memo: '編集前のテストメモ' }

const mountTransactionModal = (props: { transaction?: Transaction } = {}) =>
  mount(TransactionModal, {
    props,
    attachTo: document.body,
    global: { plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]] },
  })

const fillForm = async (wrapper: ReturnType<typeof mountTransactionModal>) => {
  await wrapper.get('input[value="income"]').setValue()
  await wrapper.get('#transaction-amount').setValue('1111')
  await wrapper.get('#transaction-occurred-at').setValue('2026-09-01T00:00')
  await wrapper.get('#transaction-memo').setValue('テストメモ')
}

enableAutoUnmount(afterEach)

describe('TransactionModal', () => {
  // 30 seconds into the first minute of September in Japan time, while it is still August in UTC
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-31T15:00:30Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('adding a transaction', () => {
    it('opens as an expense at the current minute in Japan time, with the amount and memo empty', () => {
      const wrapper = mountTransactionModal()

      expect(wrapper.get<HTMLDialogElement>('dialog').element.open).toBe(true)
      expect(wrapper.get<HTMLInputElement>('input[value="expense"]').element.checked).toBe(true)
      expect(wrapper.get<HTMLInputElement>('#transaction-amount').element.value).toBe('')
      expect(wrapper.get<HTMLInputElement>('#transaction-occurred-at').element.value).toBe('2026-09-01T00:00')
      expect(wrapper.get<HTMLTextAreaElement>('#transaction-memo').element.value).toBe('')
    })

    it('posts the form as a transaction in UTC and closes', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(addedTransaction, { status: 201 }))
      const wrapper = mountTransactionModal()

      await fillForm(wrapper)
      await wrapper.get('form').trigger('submit')
      await flushPromises()

      const [url, init] = fetchSpy.mock.calls[0]
      expect(String(url)).toContain('/api/finances/transactions')
      expect(init?.method).toBe('POST')
      expect(JSON.parse(String(init?.body))).toEqual({ occurredAt: '2026-08-31T15:00:00.000Z', kind: 'income', amount: 1111, memo: 'テストメモ' })
      expect(wrapper.get<HTMLDialogElement>('dialog').element.open).toBe(false)
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('stays open with an error when the transaction cannot be added', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }))
      const wrapper = mountTransactionModal()

      await fillForm(wrapper)
      await wrapper.get('form').trigger('submit')
      await flushPromises()

      expect(wrapper.get<HTMLDialogElement>('dialog').element.open).toBe(true)
      expect(wrapper.get('[role="alert"]').text()).toBe('登録できませんでした。')
      expect(wrapper.get<HTMLInputElement>('#transaction-amount').element.value).toBe('1111')
    })
  })

  describe('editing a transaction', () => {
    it('opens with the values of the transaction to edit, its time in Japan time', () => {
      const wrapper = mountTransactionModal({ transaction: transactionToEdit })

      expect(wrapper.get('h2').text()).toBe('明細を編集')
      expect(wrapper.get<HTMLInputElement>('input[value="expense"]').element.checked).toBe(true)
      expect(wrapper.get<HTMLInputElement>('#transaction-amount').element.value).toBe('9999')
      expect(wrapper.get<HTMLInputElement>('#transaction-occurred-at').element.value).toBe('2026-10-01T01:00')
      expect(wrapper.get<HTMLTextAreaElement>('#transaction-memo').element.value).toBe('編集前のテストメモ')
    })

    it('puts the form to the transaction to edit in UTC and closes', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ ...addedTransaction, id: 9 }))
      const wrapper = mountTransactionModal({ transaction: transactionToEdit })

      await fillForm(wrapper)
      await wrapper.get('form').trigger('submit')
      await flushPromises()

      const [url, init] = fetchSpy.mock.calls[0]
      expect(String(url)).toMatch(/\/api\/finances\/transactions\/9$/)
      expect(init?.method).toBe('PUT')
      expect(JSON.parse(String(init?.body))).toEqual({ occurredAt: '2026-08-31T15:00:00.000Z', kind: 'income', amount: 1111, memo: 'テストメモ' })
      expect(wrapper.get<HTMLDialogElement>('dialog').element.open).toBe(false)
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('stays open with an error when the transaction to edit cannot be saved', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }))
      const wrapper = mountTransactionModal({ transaction: transactionToEdit })

      await wrapper.get('form').trigger('submit')
      await flushPromises()

      expect(wrapper.get<HTMLDialogElement>('dialog').element.open).toBe(true)
      expect(wrapper.get('[role="alert"]').text()).toBe('保存できませんでした。')
    })

    it('stays open saying so when the transaction to edit was already deleted', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 404 }))
      const wrapper = mountTransactionModal({ transaction: transactionToEdit })

      await wrapper.get('form').trigger('submit')
      await flushPromises()

      expect(wrapper.get<HTMLDialogElement>('dialog').element.open).toBe(true)
      expect(wrapper.get('[role="alert"]').text()).toBe('この明細はすでに削除されています。')
    })
  })

  describe('while the request is pending', () => {
    it('disables the submit and cancel buttons', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}))
      const wrapper = mountTransactionModal()

      await fillForm(wrapper)
      await wrapper.get('form').trigger('submit')
      await flushPromises()

      expect(wrapper.findAll('button').find(button => button.text() === '登録')!.attributes()).toHaveProperty('disabled')
      expect(wrapper.findAll('button').find(button => button.text() === 'キャンセル')!.attributes()).toHaveProperty('disabled')
    })

    it('keeps Escape from closing the modal', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}))
      const wrapper = mountTransactionModal()

      await fillForm(wrapper)
      await wrapper.get('form').trigger('submit')
      await flushPromises()

      expect(pressEscape(wrapper.get('dialog').element)).toEqual({ keydownPrevented: true, cancelPrevented: true })
    })
  })

  it('lets Escape close the modal when no request is pending', () => {
    const wrapper = mountTransactionModal()

    expect(pressEscape(wrapper.get('dialog').element)).toEqual({ keydownPrevented: false, cancelPrevented: false })
  })

  it('closes without sending anything when cancelled', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const wrapper = mountTransactionModal()

    await wrapper.findAll('button').find(button => button.text() === 'キャンセル')!.trigger('click')

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(wrapper.get<HTMLDialogElement>('dialog').element.open).toBe(false)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
