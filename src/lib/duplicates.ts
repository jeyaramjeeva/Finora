import type { Transaction } from './types'

export interface DuplicateHit {
  key: string
  indexes: number[]
  existingIds: string[]
  message: string
}

function keyFor(transaction: Pick<Transaction, 'date' | 'kind' | 'amountCents' | 'description' | 'categoryId'>): string {
  return [
    transaction.date,
    transaction.kind,
    transaction.amountCents,
    transaction.description.trim().toLowerCase(),
    transaction.categoryId,
  ].join('|')
}

export function findDuplicateGroups(existing: Transaction[], incoming: Transaction[]): DuplicateHit[] {
  const existingByKey = new Map<string, string[]>()
  for (const transaction of existing) {
    const key = keyFor(transaction)
    const list = existingByKey.get(key) ?? []
    list.push(transaction.id)
    existingByKey.set(key, list)
  }
  const groups = new Map<string, DuplicateHit>()
  incoming.forEach((transaction, index) => {
    const key = keyFor(transaction)
    const prior = incoming.findIndex((item, itemIndex) => itemIndex < index && keyFor(item) === key)
    const existingIds = existingByKey.get(key) ?? []
    if (prior < 0 && existingIds.length === 0) return
    const group = groups.get(key) ?? {
      key,
      indexes: prior >= 0 ? [prior] : [],
      existingIds,
      message: existingIds.length
        ? 'A record with the same date, description, category, and amount is already stored.'
        : 'This row is repeated in the file being imported.',
    }
    group.indexes.push(index)
    groups.set(key, group)
  })
  return [...groups.values()]
}
