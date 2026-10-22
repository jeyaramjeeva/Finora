import { currentMonth } from './dates'
import type { AppState, Bill, Category, Debt, Goal, ImportResult, Transaction } from './types'

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
      filters: { month: latestActualMonth(result.transactions), categoryId: 'all', kind: 'all', origin: 'actual' },
    }
  }

  const suppressed = new Set(previous.suppressedIds)
  const edited = new Map(previous.transactions.filter((transaction) => transaction.source === 'workbook' && transaction.edited).map((transaction) => [transaction.id, transaction]))
  const manual = previous.transactions.filter((transaction) => transaction.source !== 'workbook')
  const imported = result.transactions.filter((transaction) => !suppressed.has(transaction.id) && !edited.has(transaction.id))
  const transactions = [...imported, ...edited.values(), ...manual]

  const categories = new Map<string, Category>()
  for (const category of previous.categories) categories.set(category.id, category)
  for (const category of result.categories) {
    const existing = categories.get(category.id)
    if (!existing) categories.set(category.id, category)
    else if (existing.renamed) categories.set(category.id, { ...category, name: existing.name, group: existing.group, fixed: existing.fixed, active: existing.active, renamed: true })
    else categories.set(category.id, { ...category, active: existing.active, fixed: existing.fixed, group: existing.group })
  }

  const debts = mergeDebts(previous.debts, result.debts)
  const goals = mergeGoals(previous.goals, result.goals)
  const bills = mergeBills(previous.bills, result.bills)
  const assumptions = previous.settings.assumptionsLocked
    ? previous.assumptions
    : {
        ...result.assumptions,
        manualRunRateIncomeCents: previous.assumptions.manualRunRateIncomeCents,
        manualRunRateExpenseCents: previous.assumptions.manualRunRateExpenseCents,
      }

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
    lastImportAt: new Date().toISOString(),
  }
}

function mergeDebts(previous: Debt[], incoming: Debt[]): Debt[] {
  const manual = previous.filter((debt) => debt.source === 'manual')
  const merged = incoming.map((debt) => {
    const prior = previous.find((item) => item.id === debt.id)
    if (!prior) return debt
    const manualPayments = prior.payments.filter((payment) => !payment.sourceCell)
    return {
      ...debt,
      interestRateAnnual: prior.interestRateAnnual,
      minimumPaymentCents: prior.minimumPaymentCents,
      confirmedBalanceCents: prior.confirmedBalanceCents,
      dueDay: prior.dueDay,
      payments: [...debt.payments, ...manualPayments],
    }
  })
  return [...merged, ...manual]
}

function mergeGoals(previous: Goal[], incoming: Goal[]): Goal[] {
  const manual = previous.filter((goal) => goal.source === 'manual')
  const merged = incoming.map((goal) => {
    const prior = previous.find((item) => item.id === goal.id)
    if (!prior) return goal
    return {
      ...goal,
      targetCents: prior.targetCents,
      currentBalanceCents: prior.currentBalanceCents,
      deadline: prior.deadline ?? goal.deadline,
      monthlyContributionCents: prior.monthlyContributionCents ?? goal.monthlyContributionCents,
    }
  })
  return [...merged, ...manual]
}

function mergeBills(previous: Bill[], incoming: Bill[]): Bill[] {
  const manual = previous.filter((bill) => bill.source === 'user')
  const merged = incoming.map((bill) => {
    const prior = previous.find((item) => item.id === bill.id)
    if (!prior) return bill
    return { ...bill, dueDay: prior.dueDay, active: prior.active, interval: prior.interval }
  })
  return [...merged, ...manual]
}

export function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false
  const state = value as AppState
  return state.version === 1 && Array.isArray(state.transactions) && Array.isArray(state.categories) && Array.isArray(state.debts)
}
