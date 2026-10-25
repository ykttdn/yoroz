export const TIME_ZONE_OFFSET = '+09:00'

export const MIN_YEAR = 2000
export const MAX_YEAR = 2099

// NaN for a month Date can't represent, such as month 13, which is how monthRange rejects them
const startOfMonth = (year: number, month: number) =>
  Date.parse(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01T00:00:00${TIME_ZONE_OFFSET}`)

// end is the start of the next month, so it is excluded from the range
export const monthRange = (month: string): { start: number, end: number } | undefined => {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) {
    return undefined
  }

  const year = Number(match[1])
  if (year < MIN_YEAR || year > MAX_YEAR) {
    return undefined
  }
  const monthNumber = Number(match[2])
  const start = startOfMonth(year, monthNumber)
  const end = monthNumber === 12 ? startOfMonth(year + 1, 1) : startOfMonth(year, monthNumber + 1)
  return Number.isNaN(start) || Number.isNaN(end) ? undefined : { start, end }
}

// Only the form toISOString produces is accepted, so an instant can't arrive with an offset or without its seconds.
// toISOString throws for an invalid Date, so NaN has to be ruled out first.
export const isMinuteTimestamp = (value: string) => {
  const time = Date.parse(value)
  return !Number.isNaN(time) && new Date(time).toISOString() === value && time % 60_000 === 0
}

// Bounded by the months monthRange accepts, as a transaction outside them would never be listed
export const isInYearRange = (value: string) => {
  const time = Date.parse(value)
  return startOfMonth(MIN_YEAR, 1) <= time && time < startOfMonth(MAX_YEAR + 1, 1)
}
