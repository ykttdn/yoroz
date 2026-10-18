import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Transaction } from '../types'
import FinancesView from './FinancesView.vue'

const expenseOnSeptember2: Transaction = { id: 3, occurredAt: '2026-09-02T00:30:00.000Z', kind: 'expense', amount: 3333, memo: 'テストメモ3' }
const expenseOnSeptember1: Transaction = { id: 2, occurredAt: '2026-09-01T03:30:00.000Z', kind: 'expense', amount: 2222, memo: 'テストメモ2' }
const incomeAtStartOfSeptember: Transaction = { id: 1, occurredAt: '2026-08-31T15:00:00.000Z', kind: 'income', amount: 1111, memo: '' }

const stubTransactions = (transactions: Transaction[]) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json(transactions))

const requestedUrl = (fetchSpy: ReturnType<typeof stubTransactions>) => String(fetchSpy.mock.calls[0][0])

const mountFinancesView = async () => {
  const wrapper = mount(FinancesView)
  await flushPromises()
  return wrapper
}

describe('FinancesView', () => {
  // The first minute of September in Japan time, while it is still August in UTC
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-31T15:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('lists the transactions of this month in Japan time under their days', async () => {
    const fetchSpy = stubTransactions([expenseOnSeptember2, expenseOnSeptember1, incomeAtStartOfSeptember])

    const wrapper = await mountFinancesView()

    expect(requestedUrl(fetchSpy)).toContain('/api/finances/transactions?month=2026-09')
    expect(wrapper.get('h1').text()).toBe('家計簿')
    expect(wrapper.get('h2').text()).toBe('2026年9月')
    expect(wrapper.findAll('section').map(section => [
      section.get('h3').text(),
      section.findAll('li').map(row => row.findAll('p, span').map(cell => cell.text())),
    ])).toEqual([
      ['9/2(水)', [['テストメモ3', '09:30', '-3,333円']]],
      ['9/1(火)', [['テストメモ2', '12:30', '-2,222円'], ['00:00', '+1,111円']]],
    ])
  })

  it('colors expenses red and income green', async () => {
    stubTransactions([expenseOnSeptember1, incomeAtStartOfSeptember])

    const wrapper = await mountFinancesView()

    const amounts = wrapper.findAll('li').map(row => row.findAll('span').at(-1)?.classes())
    expect(amounts[0]).toContain('text-red-600')
    expect(amounts[1]).toContain('text-green-700')
  })

  // happy-dom doesn't render line breaks, so this checks for the style that keeps them instead
  it('keeps the line breaks in a memo', async () => {
    stubTransactions([{ ...expenseOnSeptember1, memo: '1行目\n2行目' }])

    const wrapper = await mountFinancesView()

    expect(wrapper.get('li p').classes()).toContain('whitespace-pre-line')
  })

  it('says so when the month has no transactions', async () => {
    stubTransactions([])

    const wrapper = await mountFinancesView()

    expect(wrapper.text()).toContain('この月の明細はありません。')
    expect(wrapper.find('section').exists()).toBe(false)
  })

  it('shows an error when the transactions cannot be fetched', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(null, { status: 500 }))

    const wrapper = await mountFinancesView()

    expect(wrapper.get('[role="alert"]').text()).toBe('明細を読み込めませんでした。')
  })
})
