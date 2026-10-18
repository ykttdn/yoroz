import { describe, expect, it } from 'vitest'

import { currentYearMonth, formatDay, formatTime, formatYearMonth } from './datetime'

describe('currentYearMonth', () => {
  it('keeps the last minute of August in August in Japan time', () => {
    expect(currentYearMonth(new Date('2026-08-31T14:59:00Z'))).toBe('2026-08')
  })

  it('moves to September at midnight on September 1 in Japan time', () => {
    expect(currentYearMonth(new Date('2026-08-31T15:00:00Z'))).toBe('2026-09')
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
