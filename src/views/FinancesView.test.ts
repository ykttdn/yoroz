import { VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { createQueryClient } from '../queryClient'
import type { Transaction } from '../types'
import FinancesView from './FinancesView.vue'

const expenseOnOctober1: Transaction = { id: 4, occurredAt: '2026-10-01T01:00:00.000Z', kind: 'expense', amount: 4444, memo: 'テストメモ4' }
const expenseOnSeptember2: Transaction = { id: 3, occurredAt: '2026-09-02T00:30:00.000Z', kind: 'expense', amount: 3333, memo: 'テストメモ3' }
const expenseOnSeptember1: Transaction = { id: 2, occurredAt: '2026-09-01T03:30:00.000Z', kind: 'expense', amount: 2222, memo: 'テストメモ2' }
const incomeAtStartOfSeptember: Transaction = { id: 1, occurredAt: '2026-08-31T15:00:00.000Z', kind: 'income', amount: 1111, memo: '' }

const stubTransactions = (transactions: Transaction[]) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json(transactions))

const requestedUrls = (fetchSpy: ReturnType<typeof stubTransactions>) => fetchSpy.mock.calls.map(([url]) => String(url))

const requestsAborted = (fetchSpy: ReturnType<typeof stubTransactions>) => fetchSpy.mock.calls.map(([, init]) => init?.signal?.aborted)

// A bare router instead of the app's keeps the navigation guard and its request to /api/me out of these tests.
// Mounting after the navigation settles lets the first render already see the query
const mountFinancesViewAt = async (url: string) => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/finances', component: FinancesView }],
  })
  await router.push(url)
  const wrapper = mount(FinancesView, { global: { plugins: [router, [VueQueryPlugin, { queryClient: createQueryClient() }]] } })
  await flushPromises()
  return { wrapper, router }
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

  it('lists the transactions of the month in the query under their days', async () => {
    const fetchSpy = stubTransactions([expenseOnSeptember2, expenseOnSeptember1, incomeAtStartOfSeptember])

    const { wrapper } = await mountFinancesViewAt('/finances?month=2026-09')

    expect(requestedUrls(fetchSpy)).toEqual([expect.stringContaining('/api/finances/transactions?month=2026-09')])
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

    const { wrapper } = await mountFinancesViewAt('/finances?month=2026-09')

    const amounts = wrapper.findAll('li').map(row => row.findAll('span').at(-1)?.classes())
    expect(amounts[0]).toContain('text-red-600')
    expect(amounts[1]).toContain('text-green-700')
  })

  it('shows this month in Japan time when the query has no month', async () => {
    const fetchSpy = stubTransactions([])

    const { wrapper } = await mountFinancesViewAt('/finances')

    expect(requestedUrls(fetchSpy)).toEqual([expect.stringContaining('/api/finances/transactions?month=2026-09')])
    expect(wrapper.get('h2').text()).toBe('2026年9月')
  })

  it.each([
    ['an invalid month', '/finances?month=2026-13'],
    ['a month before the year 2000', '/finances?month=1999-12'],
    ['a month after the year 2099', '/finances?month=2100-01'],
    ['a repeated month', '/finances?month=2026-09&month=2026-10'],
    ['a month without a value', '/finances?month'],
  ])('says which months can be shown for %s, without fetching any', async (_, url) => {
    const fetchSpy = stubTransactions([])

    const { wrapper } = await mountFinancesViewAt(url)

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(wrapper.find('h2').exists()).toBe(false)
    expect(wrapper.get('[role="alert"]').text()).toBe('表示できない月が指定されています。2000年1月から2099年12月までの月を指定してください。')
    expect(wrapper.get('a').attributes('href')).toBe('/finances')
  })

  it('links to the previous and next months', async () => {
    stubTransactions([])

    const { wrapper } = await mountFinancesViewAt('/finances?month=2026-12')

    expect(wrapper.get('a[aria-label="前の月"]').attributes('href')).toBe('/finances?month=2026-11')
    expect(wrapper.get('a[aria-label="次の月"]').attributes('href')).toBe('/finances?month=2027-01')
  })

  it('links to no month before the year 2000', async () => {
    stubTransactions([])

    const { wrapper } = await mountFinancesViewAt('/finances?month=2000-01')

    expect(wrapper.find('a[aria-label="前の月"]').exists()).toBe(false)
    expect(wrapper.get('button[aria-label="前の月"]').attributes()).toHaveProperty('disabled')
    expect(wrapper.get('a[aria-label="次の月"]').attributes('href')).toBe('/finances?month=2000-02')
  })

  it('links to no month after the year 2099', async () => {
    stubTransactions([])

    const { wrapper } = await mountFinancesViewAt('/finances?month=2099-12')

    expect(wrapper.get('a[aria-label="前の月"]').attributes('href')).toBe('/finances?month=2099-11')
    expect(wrapper.find('a[aria-label="次の月"]').exists()).toBe(false)
    expect(wrapper.get('button[aria-label="次の月"]').attributes()).toHaveProperty('disabled')
  })

  it('fetches the transactions again when the month changes', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(async () => Response.json([expenseOnSeptember1]))
      .mockImplementationOnce(async () => Response.json([expenseOnOctober1]))
    const { wrapper, router } = await mountFinancesViewAt('/finances?month=2026-09')

    await router.push('/finances?month=2026-10')
    await flushPromises()

    expect(requestedUrls(fetchSpy)).toEqual([
      expect.stringContaining('/api/finances/transactions?month=2026-09'),
      expect.stringContaining('/api/finances/transactions?month=2026-10'),
    ])
    expect(wrapper.get('h2').text()).toBe('2026年10月')
    expect(wrapper.findAll('li p').map(memo => memo.text())).toEqual(['テストメモ4'])
  })

  it('keeps the latest month when an earlier response arrives last', async () => {
    const respond: ((response: Response) => void)[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(resolve => respond.push(resolve)))
    const { wrapper, router } = await mountFinancesViewAt('/finances?month=2026-09')
    await router.push('/finances?month=2026-10')
    await flushPromises()

    // respond holds one resolver per request in the order they were sent, [0] for September and [1] for October, so
    // answering October first makes September's response arrive last
    respond[1](Response.json([expenseOnOctober1]))
    await flushPromises()
    respond[0](Response.json([expenseOnSeptember1]))
    await flushPromises()

    expect(wrapper.findAll('li p').map(memo => memo.text())).toEqual(['テストメモ4'])
  })

  it('aborts the request for a month once another month is shown', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}))
    const { router } = await mountFinancesViewAt('/finances?month=2026-09')

    await router.push('/finances?month=2026-10')
    await flushPromises()

    expect(requestsAborted(fetchSpy)).toEqual([true, false])
  })

  it('aborts the pending request when the page is left', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}))
    const { wrapper } = await mountFinancesViewAt('/finances?month=2026-09')

    wrapper.unmount()

    expect(requestsAborted(fetchSpy)).toEqual([true])
  })

  it('shows a spinner instead of an empty month until the transactions arrive', async () => {
    const respond: ((response: Response) => void)[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(resolve => respond.push(resolve)))

    const { wrapper } = await mountFinancesViewAt('/finances?month=2026-09')

    expect(wrapper.find('[role="status"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('この月の明細はありません。')

    respond[0](Response.json([expenseOnSeptember1]))
    await flushPromises()

    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.findAll('li p').map(memo => memo.text())).toEqual(['テストメモ2'])
  })

  it('hides the previous month\'s transactions while the next month loads', async () => {
    const respond: ((response: Response) => void)[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(resolve => respond.push(resolve)))
    const { wrapper, router } = await mountFinancesViewAt('/finances?month=2026-09')
    respond[0](Response.json([expenseOnSeptember1]))
    await flushPromises()

    await router.push('/finances?month=2026-10')
    await flushPromises()

    expect(wrapper.get('h2').text()).toBe('2026年10月')
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
    expect(wrapper.findAll('li p').map(memo => memo.text())).toEqual([])
  })

  it('says so when the month has no transactions', async () => {
    stubTransactions([])

    const { wrapper } = await mountFinancesViewAt('/finances?month=2026-09')

    expect(wrapper.text()).toContain('この月の明細はありません。')
    expect(wrapper.find('section').exists()).toBe(false)
  })

  it('shows an error when the transactions cannot be fetched', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(null, { status: 500 }))

    const { wrapper } = await mountFinancesViewAt('/finances?month=2026-09')

    expect(wrapper.get('[role="alert"]').text()).toBe('明細を読み込めませんでした。')
  })
})
