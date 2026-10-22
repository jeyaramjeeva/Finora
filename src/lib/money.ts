export function toCents(euros: number): number {
  if (!Number.isFinite(euros)) {
    throw new Error('Amount is not a finite number')
  }
  const sign = euros < 0 ? -1 : 1
  return sign * Math.round(Math.abs(euros) * 100 + 1e-8)
}

export function centsToEuros(cents: number): number {
  return cents / 100
}

export function formatMoney(cents: number | null, currency = 'EUR'): string {
  if (cents === null || Number.isNaN(cents)) return '—'
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export function formatPercent(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)}%`
}

export function formatPlain(cents: number): string {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export function parseAmount(input: string): number | null {
  const trimmed = input.trim().replace(/\s/g, '')
  if (!trimmed) return null
  const normalized = trimmed.includes(',') && trimmed.lastIndexOf(',') > trimmed.lastIndexOf('.')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed.replace(/,/g, '')
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null
  const value = Number(normalized)
  if (!Number.isFinite(value)) return null
  return toCents(value)
}

export function sumCents(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}
