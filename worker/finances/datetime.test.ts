import { describe, expect, it } from 'vitest'

import { monthRange } from './datetime'

describe('monthRange', () => {
  it('returns the instants a month in Japan time covers', () => {
    expect(monthRange('2026-09')).toEqual({
      start: Date.parse('2026-08-31T15:00:00Z'),
      end: Date.parse('2026-09-30T15:00:00Z'),
    })
  })

  it('ends December at the start of January in the next year', () => {
    expect(monthRange('2026-12')).toEqual({
      start: Date.parse('2026-11-30T15:00:00Z'),
      end: Date.parse('2026-12-31T15:00:00Z'),
    })
  })

  it.each([
    ['a month out of range', '2026-13'],
    ['month zero', '2026-00'],
    ['a month without a leading zero', '2026-9'],
    ['a date', '2026-09-01'],
    ['an empty string', ''],
    // Its end, January 10000, is beyond the four-digit years Date accepts
    ['the last month Date can start', '9999-12'],
  ])('rejects %s', (_, month) => {
    expect(monthRange(month)).toBeUndefined()
  })
})
