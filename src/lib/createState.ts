import { currentMonth } from './dates'
import type { AppState, Category, ImportResult, Transaction } from './types'

export function uid(prefix: string): string {
  return `${prefix}:${crypto.randomUUID()}`
}

export function latestActualMonth(transactions: Transaction[], asOf = new Date()): string {
  const months = transactions.filter((transaction) => transaction.origin === 'actual').map((transaction) => transaction.date.slice(0, 7))
  return months.sort().at(-1) ?? currentMonth(asOf)
}

export function createState(result: ImportResult, previous?: AppState): AppState {
  if (!previous) {
    return {
      version: 1,
      transactions: result.transactions,
      categories: result.categories,
      budgets: [],
      goals: result.goals,
      debts: result.debts,
      incomePlans: result.incomePlans,
      recurring: result.recurring,
      bills: result.bills,
      assumptions: result.assumptions,
      coverage: result.coverage,
      issues: result.issues,
      reconciliation: result.reconciliation,
      stats: result.stats,
      suppressedIds: [],
      settings: { theme: 'light', sidebarCollapsed: false, assumptionsLocked: false },
      lastImportAt: new Date().toISOString(),
      filters: { month: latestActualMonth(result.transactions), categoryId: 'all', kind: 'all', origin: 'actual', chapter: 'student' },
    }
  }

  const manual = previous.transactions.filter((transaction) => transaction.source !== 'workbook')
  const transactions = [...result.transactions, ...manual]

  const categories = new Map<string, Category>()
  for (const category of result.categories) categories.set(category.id, category)
  for (const category of previous.categories) {
    if (!categories.has(category.id) && manual.some((transaction) => transaction.categoryId === category.id)) {
      categories.set(category.id, category)
    }
  }

  const debts = [...result.debts, ...previous.debts.filter((debt) => debt.source === 'manual')]
  const goals = [...result.goals, ...previous.goals.filter((goal) => goal.source === 'manual')]
  const bills = [...result.bills, ...previous.bills.filter((bill) => bill.source === 'user')]
  const assumptions = previous.settings.assumptionsLocked
    ? previous.assumptions
    : {
        ...result.assumptions,
        manualRunRateIncomeCents: previous.assumptions.manualRunRateIncomeCents,
        manualRunRateExpenseCents: previous.assumptions.manualRunRateExpenseCents,
      }

  const actualMonths = transactions.filter((t) => t.origin === 'actual').map((t) => t.date.slice(0, 7))
  const latestMonth = latestActualMonth(transactions)
  const currentMonthValid = previous.filters.month === 'all' || actualMonths.includes(previous.filters.month)

  return {
    ...previous,
    transactions,
    categories: [...categories.values()].sort((a, b) => a.name.localeCompare(b.name)),
    debts,
    goals,
    bills,
    incomePlans: result.incomePlans,
    recurring: result.recurring,
    assumptions,
    coverage: result.coverage,
    issues: result.issues,
    reconciliation: result.reconciliation,
    stats: result.stats,
    suppressedIds: [],
    lastImportAt: new Date().toISOString(),
    filters: {
      ...previous.filters,
      month: currentMonthValid ? previous.filters.month : latestMonth,
    },
  }
}

export function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false
  const state = value as AppState
  return state.version === 1 && Array.isArray(state.transactions) && Array.isArray(state.categories) && Array.isArray(state.debts)
}
