import { describe, expect, it } from 'vitest'

import { isMinuteTimestamp, monthRange } from './datetime'

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

describe('isMinuteTimestamp', () => {
  it('accepts a UTC timestamp on the minute', () => {
    expect(isMinuteTimestamp('2026-09-27T01:30:00.000Z')).toBe(true)
  })

  it('accepts the last minute of November 9999 in Japan time', () => {
    expect(isMinuteTimestamp('9999-11-30T14:59:00.000Z')).toBe(true)
  })

  it.each([
    ['an offset', '2026-09-27T10:30:00.000+09:00'],
    ['no milliseconds', '2026-09-27T01:30:00Z'],
    ['no seconds', '2026-09-27T01:30Z'],
    ['no time zone', '2026-09-27T01:30:00.000'],
    ['only a date', '2026-09-27'],
    ['seconds', '2026-09-27T01:30:15.000Z'],
    ['milliseconds', '2026-09-27T01:30:00.001Z'],
    ['a day that does not exist', '2026-02-30T01:30:00.000Z'],
    ['the first minute of December 9999 in Japan time', '9999-11-30T15:00:00.000Z'],
    // toISOString writes these years with six digits and a sign, which monthRange doesn't accept
    ['a year after 9999', '+010000-01-01T00:00:00.000Z'],
    ['a year before 0', '-000001-01-01T00:00:00.000Z'],
    ['nothing', ''],
  ])('rejects a timestamp with %s', (_, value) => {
    expect(isMinuteTimestamp(value)).toBe(false)
  })
})
