const TIME_ZONE_OFFSET = '+09:00'

// NaN for a month Date can't represent, such as month 13 or year 10000, which is how monthRange rejects them
const startOfMonth = (year: number, month: number) =>
  Date.parse(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01T00:00:00${TIME_ZONE_OFFSET}`)

// end is the start of the next month, so it is excluded from the range
export const monthRange = (month: string): { start: number, end: number } | undefined => {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) {
    return undefined
  }

  const year = Number(match[1])
  const monthNumber = Number(match[2])
  const start = startOfMonth(year, monthNumber)
  const end = monthNumber === 12 ? startOfMonth(year + 1, 1) : startOfMonth(year, monthNumber + 1)
  return Number.isNaN(start) || Number.isNaN(end) ? undefined : { start, end }
}
