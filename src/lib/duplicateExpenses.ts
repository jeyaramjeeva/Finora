import type { Transaction } from './types'

export interface DuplicateExpenseGroup {
  date: string
  amountCents: number
  categoryId: string
  count: number
  descriptions: string[]
  transactionIds: string[]
}

/**
 * Flag expenses that share the same calendar day + amount + category/kind.
 * Useful for catching accidental double entries or duplicate subscriptions.
 * Ported & adapted from nasta-dashboard/src/lib/duplicateExpenses.ts
 */
export function findDuplicateExpenses(transactions: Transaction[]): DuplicateExpenseGroup[] {
  const map = new Map<
    string,
    {
      date: string
      amountCents: number
      categoryId: string
      descriptions: string[]
      transactionIds: string[]
    }
  >()

  for (const t of transactions) {
    if (t.kind !== 'expense') continue
    const date = (t.date || '').slice(0, 10)
    const amountCents = Math.abs(t.amountCents)
    if (!date || amountCents <= 0) continue

    const key = `${date}|${t.categoryId}|${amountCents}`
    const row = map.get(key)
    if (!row) {
      map.set(key, {
        date,
        amountCents,
        categoryId: t.categoryId,
        descriptions: [t.description || 'Expense'].filter(Boolean),
        transactionIds: [t.id],
      })
    } else {
      row.descriptions.push(t.description || 'Expense')
      if (!row.transactionIds.includes(t.id)) {
        row.transactionIds.push(t.id)
      }
    }
  }

  return [...map.values()]
    .filter((g) => g.descriptions.length >= 2)
    .map((g) => ({
      ...g,
      count: g.descriptions.length,
      descriptions: uniqueKeepOrder(g.descriptions),
    }))
    .sort((a, b) => b.count - a.count || b.amountCents - a.amountCents || b.date.localeCompare(a.date))
}

function uniqueKeepOrder(items: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    const k = item.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(item)
  }
  return out
}

export function formatDuplicateAlert(group: DuplicateExpenseGroup): string {
  const descs = group.descriptions.slice(0, 3).join('; ')
  const more = group.descriptions.length > 3 ? ` +${group.descriptions.length - 3} more` : ''
  const amountFormatted = (group.amountCents / 100).toFixed(2)
  return `Potential duplicate: €${amountFormatted} on ${group.date} (${group.count}×) - ${descs}${more}`
}
