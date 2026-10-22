export function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`
}

export function monthKey(date: string): string {
  return date.slice(0, 7)
}

export function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number)
  if (!year || !m) return month
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, m - 1, 1)),
  )
}

export function shortMonth(month: string): string {
  const [year, m] = month.split('-').map(Number)
  if (!year || !m) return month
  return new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, m - 1, 1)),
  )
}

export function addMonths(month: string, count: number): string {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, m - 1 + count, 1))
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`
}

export function compareMonth(a: string, b: string): number {
  return a.localeCompare(b)
}

export function monthsBetween(start: string, end: string): string[] {
  const months: string[] = []
  let cursor = start
  while (cursor <= end && months.length < 600) {
    months.push(cursor)
    cursor = addMonths(cursor, 1)
  }
  return months
}

export function daysInMonth(month: string): number {
  const [year, m] = month.split('-').map(Number)
  return new Date(Date.UTC(year, m, 0)).getUTCDate()
}

export function currentMonth(asOf = new Date()): string {
  return `${asOf.getFullYear()}-${pad(asOf.getMonth() + 1)}`
}

export function isoFromUnknown(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const utcMidnight = value.getUTCHours() === 0 && value.getUTCMinutes() === 0 && value.getUTCSeconds() === 0
    const localMidnight = value.getHours() === 0 && value.getMinutes() === 0 && value.getSeconds() === 0
    if (utcMidnight) return ymd(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate())
    if (localMidnight) return ymd(value.getFullYear(), value.getMonth() + 1, value.getDate())
    return ymd(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate())
  }
  if (typeof value === 'number' && value > 20000 && value < 90000) {
    const utc = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000)
    return ymd(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate())
  }
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) return `${match[1]}-${match[2]}-${match[3]}`
  }
  return null
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function monthEnd(month: string): string {
  return ymd(Number(month.slice(0, 4)), Number(month.slice(5, 7)), daysInMonth(month))
}

export function deadlineFromLabel(label: string): string | null {
  const match = label.match(/till\s+([a-z]{3})[a-z]*-(\d{4})/i)
  if (!match) return null
  const names = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const index = names.indexOf(match[1].slice(0, 3).toLowerCase())
  if (index < 0) return null
  return ymd(Number(match[2]), index + 1, 1)
}
