import type { Category, TxKind } from './types'

export interface ClassifiedName {
  group: string
  kind: TxKind
  fixed: boolean
  review: boolean
}

const RULES: Array<{ test: RegExp; group: string; kind: TxKind; fixed: boolean; review?: boolean }> = [
  { test: /rent|accommodation/, group: 'Rent and accommodation', kind: 'expense', fixed: true },
  { test: /electric|heating|\bgas\b|water|utility/, group: 'Utilities', kind: 'expense', fixed: true },
  { test: /cook|grocer|^food$/, group: 'Groceries and cooking', kind: 'expense', fixed: false },
  { test: /restaurant|takeaway/, group: 'Restaurants and takeaways', kind: 'expense', fixed: false },
  { test: /shopping/, group: 'Shopping and personal care', kind: 'expense', fixed: false },
  { test: /movie/, group: 'Other expenses', kind: 'expense', fixed: false },
  { test: /deutschland/, group: 'Transportation and travel', kind: 'expense', fixed: true },
  { test: /travel|ticket|trip|transport/, group: 'Transportation and travel', kind: 'expense', fixed: false },
  { test: /phone|fibernet|mobile|internet|radio|id recharge/, group: 'Phone and internet', kind: 'expense', fixed: true },
  { test: /insurance/, group: 'Insurance', kind: 'expense', fixed: true },
  { test: /amazon|shop|dress|hair|\bdm\b|purchase|buy new|mediamarkt|household|personal/, group: 'Shopping and personal care', kind: 'expense', fixed: false },
  { test: /netflix|apple music|prime|subscription|software|\bgym\b/, group: 'Subscriptions', kind: 'expense', fixed: true },
  { test: /sem fee|semester|education|passport|residence/, group: 'Education', kind: 'expense', fixed: false },
  { test: /family support|gift/, group: 'Family support and transfers', kind: 'expense', fixed: false },
  { test: /^repay$|loan repay/, group: 'Loan and debt repayments', kind: 'debt_payment', fixed: true },
  { test: /withdraw|balance transfer/, group: 'Transfers', kind: 'transfer', fixed: false },
  { test: /\bcash\b/, group: 'Other expenses', kind: 'expense', fixed: false, review: true },
  { test: /sip|gold|emergency|trimble internal|invest/, group: 'Savings and investments', kind: 'savings_contribution', fixed: true },
  { test: /earning|salary|income brutto|received/, group: 'Income', kind: 'income', fixed: true },
]

export function slug(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return base || 'category'
}

export function classifyName(name: string): ClassifiedName {
  const key = name.trim().replace(/\s+/g, ' ').toLowerCase()
  for (const rule of RULES) {
    if (rule.test.test(key)) {
      return { group: rule.group, kind: rule.kind, fixed: rule.fixed, review: Boolean(rule.review) }
    }
  }
  return { group: 'Other expenses', kind: 'expense', fixed: false, review: key === 'others' || key === 'other' }
}

export function categoryFromName(name: string, existing?: Category): Category {
  const trimmed = name.trim().replace(/\s+/g, ' ')
  const classified = classifyName(trimmed)
  if (existing) return existing
  return {
    id: slug(trimmed),
    name: trimmed,
    group: classified.group,
    kind: classified.kind,
    fixed: classified.fixed,
    active: true,
    sourceName: trimmed,
  }
}

export function ensureCategory(categories: Map<string, Category>, name: string, overrides?: Partial<Category>): Category {
  const trimmed = name.trim().replace(/\s+/g, ' ')
  const id = overrides?.id ?? slug(trimmed)
  const current = categories.get(id)
  if (current) return current
  const created = { ...categoryFromName(trimmed), ...overrides, id, sourceName: trimmed }
  categories.set(id, created)
  return created
}
