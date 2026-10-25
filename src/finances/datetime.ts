import { MAX_YEAR, MIN_YEAR, monthRange, TIME_ZONE_OFFSET } from '../../worker/finances/datetime'

// Dates are always shown in Japan time, whatever the browser's time zone is,
// so nothing here uses the Date methods that read the browser's time zone
const TIME_ZONE = 'Asia/Tokyo'

const yearMonthFormat = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit' })

const dayFormat = new Intl.DateTimeFormat('ja-JP', { timeZone: TIME_ZONE, month: 'numeric', day: 'numeric', weekday: 'short' })

// h23 so that midnight is 00:00, never 24:00
const timeFormat = new Intl.DateTimeFormat('ja-JP', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

const dateTimeLocalFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

const partsOf = (format: Intl.DateTimeFormat, date: Date) =>
  Object.fromEntries(format.formatToParts(date).map(({ type, value }) => [type, value]))

export const isListableYearMonth = (value: unknown): value is string =>
  typeof value === 'string' && monthRange(value) !== undefined

export const currentYearMonth = (now = new Date()) => {
  const { year, month } = partsOf(yearMonthFormat, now)
  return `${year}-${month}`
}

export const shiftYearMonth = (yearMonth: string, delta: number) => {
  const [year, month] = yearMonth.split('-').map(Number)
  const index = year * 12 + (month - 1) + delta
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

export const formatYearMonth = (yearMonth: string) => {
  const [year, month] = yearMonth.split('-').map(Number)
  return `${year}年${month}月`
}

export const formatDay = (occurredAt: string) => dayFormat.format(new Date(occurredAt))

export const formatTime = (occurredAt: string) => timeFormat.format(new Date(occurredAt))

export const MIN_DATE_TIME_LOCAL = `${MIN_YEAR}-01-01T00:00`
export const MAX_DATE_TIME_LOCAL = `${MAX_YEAR}-12-31T23:59`

export const toDateTimeLocal = (date: Date) => {
  const { year, month, day, hour, minute } = partsOf(dateTimeLocalFormat, date)
  return `${year}-${month}-${day}T${hour}:${minute}`
}

// A datetime-local value has no offset, and new Date() would read it in the browser's time zone
export const fromDateTimeLocal = (value: string) => new Date(`${value}:00${TIME_ZONE_OFFSET}`).toISOString()
