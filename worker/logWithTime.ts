// workerd runs in UTC, so without timeZone these times would be 9 hours off from Vite's own log lines
const timeFormat = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', hour: 'numeric', minute: 'numeric', second: 'numeric' })

// Dims the time the same way Vite does
export const logWithTime = (message: string) => console.log(`\x1b[2m${timeFormat.format(new Date())}\x1b[0m ${message}`)
