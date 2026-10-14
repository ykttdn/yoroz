import { describe, expect, it } from 'vitest'

import { isInYearRange, isMinuteTimestamp, monthRange } from './datetime'

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

  it('returns the first month of the year 2000', () => {
    expect(monthRange('2000-01')).toEqual({
      start: Date.parse('1999-12-31T15:00:00Z'),
      end: Date.parse('2000-01-31T15:00:00Z'),
    })
  })

  it('returns the last month of the year 2099', () => {
    expect(monthRange('2099-12')).toEqual({
      start: Date.parse('2099-11-30T15:00:00Z'),
      end: Date.parse('2099-12-31T15:00:00Z'),
    })
  })

  it.each([
    ['a month out of range', '2026-13'],
    ['month zero', '2026-00'],
    ['a month without a leading zero', '2026-9'],
    ['a date', '2026-09-01'],
    ['an empty string', ''],
    ['a month before the year 2000', '1999-12'],
    ['a month after the year 2099', '2100-01'],
  ])('rejects %s', (_, month) => {
    expect(monthRange(month)).toBeUndefined()
  })
})

describe('isMinuteTimestamp', () => {
  it('accepts a UTC timestamp on the minute', () => {
    expect(isMinuteTimestamp('2026-09-27T01:30:00.000Z')).toBe(true)
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
    ['nothing', ''],
  ])('rejects a timestamp with %s', (_, value) => {
    expect(isMinuteTimestamp(value)).toBe(false)
  })
})

describe('isInYearRange', () => {
  it.each([
    ['the first minute of the year 2000 in Japan time', '1999-12-31T15:00:00.000Z'],
    ['the last minute of the year 2099 in Japan time', '2099-12-31T14:59:00.000Z'],
  ])('accepts %s', (_, value) => {
    expect(isInYearRange(value)).toBe(true)
  })

  it.each([
    ['the last minute of the year 1999 in Japan time', '1999-12-31T14:59:00.000Z'],
    ['the first minute of the year 2100 in Japan time', '2099-12-31T15:00:00.000Z'],
    ['nothing', ''],
  ])('rejects %s', (_, value) => {
    expect(isInYearRange(value)).toBe(false)
  })
})
