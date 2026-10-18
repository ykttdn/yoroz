// Dates are always shown in Japan time, whatever the browser's time zone is,
// so nothing here uses the Date methods that read the browser's time zone
const TIME_ZONE = 'Asia/Tokyo'

const yearMonthFormat = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit' })

const dayFormat = new Intl.DateTimeFormat('ja-JP', { timeZone: TIME_ZONE, month: 'numeric', day: 'numeric', weekday: 'short' })

// h23 so that midnight is 00:00, never 24:00
const timeFormat = new Intl.DateTimeFormat('ja-JP', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

export const currentYearMonth = (now = new Date()) => {
  const parts = yearMonthFormat.formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value
  return `${part('year')}-${part('month')}`
}

export const formatYearMonth = (yearMonth: string) => {
  const [year, month] = yearMonth.split('-').map(Number)
  return `${year}年${month}月`
}

export const formatDay = (occurredAt: string) => dayFormat.format(new Date(occurredAt))

export const formatTime = (occurredAt: string) => timeFormat.format(new Date(occurredAt))
