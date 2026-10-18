import { describe, expect, it } from 'vitest'

import { currentYearMonth, formatDay, formatTime, formatYearMonth, isListableYearMonth, shiftYearMonth } from './datetime'

describe('isListableYearMonth', () => {
  it.each([
    ['a month within the years 2000 to 2099', '2026-09'],
    ['the first month of the year 2000', '2000-01'],
    ['the last month of the year 2099', '2099-12'],
  ])('accepts %s', (_, value) => {
    expect(isListableYearMonth(value)).toBe(true)
  })

  it.each([
    ['a month out of range', '2026-13'],
    ['month zero', '2026-00'],
    ['a month without a leading zero', '2026-9'],
    ['a month before the year 2000', '1999-12'],
    ['a month after the year 2099', '2100-01'],
    ['a repeated query parameter', ['2026-09', '2026-10']],
    ['a missing query parameter', undefined],
  ])('rejects %s', (_, value) => {
    expect(isListableYearMonth(value)).toBe(false)
  })
})

describe('currentYearMonth', () => {
  it('keeps the last minute of August in August in Japan time', () => {
    expect(currentYearMonth(new Date('2026-08-31T14:59:00Z'))).toBe('2026-08')
  })

  it('moves to September at midnight on September 1 in Japan time', () => {
    expect(currentYearMonth(new Date('2026-08-31T15:00:00Z'))).toBe('2026-09')
  })
})

describe('shiftYearMonth', () => {
  it('moves to the previous and next months', () => {
    expect(shiftYearMonth('2026-09', -1)).toBe('2026-08')
    expect(shiftYearMonth('2026-09', 1)).toBe('2026-10')
  })

  it('moves across a year', () => {
    expect(shiftYearMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftYearMonth('2026-01', -1)).toBe('2025-12')
  })
})

describe('formatYearMonth', () => {
  it('formats a year and month for a heading', () => {
    expect(formatYearMonth('2026-09')).toBe('2026年9月')
  })
})

describe('formatDay', () => {
  it('shows the date in Japan time', () => {
    expect(formatDay('2026-08-31T15:00:00.000Z')).toBe('9/1(火)')
  })
})

describe('formatTime', () => {
  it('shows the time in Japan time, with midnight as 00:00', () => {
    expect(formatTime('2026-08-31T15:00:00.000Z')).toBe('00:00')
  })
})
