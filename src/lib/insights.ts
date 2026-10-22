import { monthKey } from './dates'
import type { Transaction } from './types'

export interface SpendObservation {
  month: string
  categoryId: string
  previousMonth: string
  previousCents: number
  currentCents: number
  message: string
}

export function unusualIncreases(transactions: Transaction[]): SpendObservation[] {
  const actual = transactions.filter((transaction) => transaction.origin === 'actual' && transaction.kind === 'expense')
  const byMonth = new Map<string, Map<string, number>>()
  for (const transaction of actual) {
    const month = monthKey(transaction.date)
    const categories = byMonth.get(month) ?? new Map<string, number>()
    categories.set(transaction.categoryId, (categories.get(transaction.categoryId) ?? 0) + transaction.amountCents)
    byMonth.set(month, categories)
  }
  const months = [...byMonth.keys()].sort()
  const observations: SpendObservation[] = []
  for (let index = 1; index < months.length; index += 1) {
    const month = months[index]
    const previousMonth = months[index - 1]
    const current = byMonth.get(month)!
    const previous = byMonth.get(previousMonth)!
    for (const [categoryId, currentCents] of current) {
      const previousCents = previous.get(categoryId)
      if (previousCents === undefined || previousCents <= 0) continue
      const diff = currentCents - previousCents
      if (diff >= 5000 && currentCents >= previousCents * 1.5) {
        observations.push({
          month,
          categoryId,
          previousMonth,
          previousCents,
          currentCents,
          message: 'Recorded spending in this category is at least 50% and €50 above the previous month that had this category.',
        })
      }
    }
  }
  return observations.sort((a, b) => b.currentCents - b.previousCents - (a.currentCents - a.previousCents))
}

export interface StableCharge {
  categoryId: string
  months: number
  typicalCents: number
  latestCents: number
}

export function stableCharges(transactions: Transaction[]): StableCharge[] {
  const byCategory = new Map<string, Map<string, number>>()
  for (const transaction of transactions) {
    if (transaction.origin !== 'actual' || transaction.kind !== 'expense') continue
    const months = byCategory.get(transaction.categoryId) ?? new Map<string, number>()
    const month = monthKey(transaction.date)
    months.set(month, (months.get(month) ?? 0) + transaction.amountCents)
    byCategory.set(transaction.categoryId, months)
  }
  const result: StableCharge[] = []
  for (const [categoryId, months] of byCategory) {
    const totals = [...months.entries()].sort(([a], [b]) => a.localeCompare(b))
    if (totals.length < 4) continue
    const recent = totals.slice(-6)
    const values = recent.map(([, value]) => value)
    const mid = [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
    const close = values.filter((value) => Math.abs(value - mid) <= Math.max(200, mid * 0.1)).length
    if (close >= 4) {
      result.push({ categoryId, months: recent.length, typicalCents: mid, latestCents: values[values.length - 1] })
    }
  }
  return result.sort((a, b) => b.typicalCents - a.typicalCents)
}
