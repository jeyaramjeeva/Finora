import { activeChapter, employedMonths, planSnapshot, scopeState } from './chapter'
import { eligibleSpend, monthFigures, outstandingDebt, previousMonthDelta } from './calc'
import { addMonths, monthLabel, shortMonth } from './dates'
import { buildForecast, type ForecastModel, type ScenarioCopy } from './forecast'
import type { AppState, Category, Transaction, TxKind } from './types'

export function categoryById(state: AppState, id: string): Category | undefined {
  return state.categories.find((category) => category.id === id)
}

export function categoryName(state: AppState, id: string): string {
  return categoryById(state, id)?.name ?? id
}

export function monthChoices(state: AppState, asOf = new Date()): string[] {
  if (activeChapter(state) === 'employed') return employedMonths(state).slice().reverse()
  const view = scopeState(state)
  const months = new Set<string>()
  for (const transaction of view.transactions) months.add(transaction.date.slice(0, 7))
  for (const row of view.coverage) months.add(row.month)
  const now = `${asOf.getFullYear()}-${String(asOf.getMonth() + 1).padStart(2, '0')}`
  months.add(now)
  return [...months].sort().reverse()
}

export function coverageFor(state: AppState, month: string) {
  return state.coverage.find((row) => row.month === month)
}

export function selectedFigures(state: AppState) {
  const view = scopeState(state)
  if (activeChapter(view) === 'employed') {
    const months = view.filters.month === 'all' ? employedMonths(view).slice(0, 12) : [view.filters.month]
    return foldPlans(view, months)
  }
  if (view.filters.month === 'all') {
    const months = [...new Set(view.transactions.filter((transaction) => transaction.origin === 'actual').map((transaction) => transaction.date.slice(0, 7)))].sort()
    if (months.length === 0) return monthFigures([], 'all')
    let income = 0
    let expense = 0
    let debt = 0
    let incomeKnown = false
    let expenseKnown = false
    for (const month of months) {
      const figures = monthFigures(view.transactions, month, coverageFor(view, month))
      if (figures.incomeCents !== null) {
        income += figures.incomeCents
        incomeKnown = true
      }
      if (figures.expenseCents !== null) {
        expense += figures.expenseCents
        expenseKnown = true
      }
      if (figures.debtPaymentCents !== null) debt += figures.debtPaymentCents
    }
    const savings = incomeKnown && expenseKnown ? income - expense - debt : null
    return {
      month: 'all',
      hasRecords: true,
      incomeKnown,
      expenseKnown,
      incomeCents: incomeKnown ? income : null,
      expenseCents: expenseKnown ? expense : null,
      debtPaymentCents: expenseKnown ? debt : null,
      transferCents: null,
      savingsContributionCents: null,
      savingsCents: savings,
      savingsRate: savings !== null && income > 0 ? (savings / income) * 100 : null,
      availableCents: savings,
    }
  }
  return monthFigures(view.transactions, view.filters.month, coverageFor(view, view.filters.month))
}

export function previousFigures(state: AppState) {
  const view = scopeState(state)
  if (view.filters.month === 'all') return null
  const month = addMonths(view.filters.month, -1)
  if (activeChapter(view) === 'employed') return planSnapshot(view, month)
  return monthFigures(view.transactions, month, coverageFor(view, month))
}

export function compare(current: number | null, previous: number | null): number | null {
  return previousMonthDelta(current, previous)
}

export function visibleTransactions(state: AppState, extra?: { search?: string; from?: string; to?: string }): Transaction[] {
  const view = scopeState(state)
  const search = extra?.search?.trim().toLowerCase()
  return view.transactions.filter((transaction) => {
    if (state.filters.month !== 'all' && transaction.date.slice(0, 7) !== state.filters.month) return false
    if (state.filters.categoryId !== 'all' && transaction.categoryId !== state.filters.categoryId) return false
    if (state.filters.kind !== 'all' && transaction.kind !== state.filters.kind) return false
    if (state.filters.origin !== 'all' && transaction.origin !== state.filters.origin) return false
    if (extra?.from && transaction.date < extra.from) return false
    if (extra?.to && transaction.date > extra.to) return false
    if (!search) return true
    const haystack = `${transaction.description} ${transaction.notes} ${categoryName(state, transaction.categoryId)} ${transaction.account}`.toLowerCase()
    return haystack.includes(search)
  })
}

export function trend(state: AppState, endMonth: string, count = 12): Array<{ month: string; label: string; income: number | null; expense: number | null; savings: number | null; rate: number | null }> {
  const view = scopeState(state)
  const end = endMonth === 'all'
    ? (activeChapter(view) === 'employed' ? employedMonths(view)[Math.min(11, employedMonths(view).length - 1)] : latest(view))
    : endMonth
  if (!end) return []
  const start = addMonths(end, -(count - 1))
  const rows = []
  let cursor = start
  while (cursor <= end) {
    const figures = activeChapter(view) === 'employed' ? planSnapshot(view, cursor) : monthFigures(view.transactions, cursor, coverageFor(view, cursor))
    rows.push({
      month: cursor,
      label: shortMonth(cursor),
      income: figures.incomeCents === null ? null : figures.incomeCents / 100,
      expense: figures.expenseCents === null ? null : figures.expenseCents / 100,
      savings: figures.savingsCents === null ? null : figures.savingsCents / 100,
      rate: figures.savingsRate,
    })
    cursor = addMonths(cursor, 1)
  }
  return rows
}

function latest(state: AppState): string | null {
  return state.transactions.filter((transaction) => transaction.origin === 'actual').map((transaction) => transaction.date.slice(0, 7)).sort().at(-1) ?? null
}

export function categoryTotals(transactions: Transaction[], kind: TxKind = 'expense'): Array<{ id: string; cents: number }> {
  const totals = new Map<string, number>()
  for (const transaction of transactions) {
    if (transaction.kind !== kind || transaction.origin !== 'actual') continue
    totals.set(transaction.categoryId, (totals.get(transaction.categoryId) ?? 0) + transaction.amountCents)
  }
  return [...totals.entries()].map(([id, cents]) => ({ id, cents })).sort((a, b) => b.cents - a.cents)
}

export function budgetSummary(state: AppState, month: string): { remaining: number | null; over: boolean; count: number } {
  const view = scopeState(state)
  const monthly = view.budgets.filter((budget) => budget.period === 'month')
  if (month === 'all' || monthly.length === 0) return { remaining: null, over: false, count: monthly.length }
  let remaining = 0
  for (const budget of monthly) {
    remaining += budget.amountCents - eligibleSpend(view.transactions, budget.categoryId, { month })
  }
  return { remaining, over: remaining < 0, count: monthly.length }
}

export function knownSavingsBalance(state: AppState): number | null {
  const goals = scopeState(state).goals
  if (goals.length === 0) return null
  if (goals.some((goal) => goal.currentBalanceCents === null)) return null
  return goals.reduce((sum, goal) => sum + (goal.currentBalanceCents ?? 0), 0)
}

export function debtSummary(state: AppState) {
  return outstandingDebt(scopeState(state).debts)
}

export function forecastFor(state: AppState, count: number, scenarioId: ScenarioCopy['id']): ForecastModel {
  const view = scopeState(state)
  const employed = activeChapter(view) === 'employed'
  const start = view.filters.month === 'all'
    ? (employed ? (view.assumptions.planStart ?? '2027-01') : addMonths(latest(view) ?? monthChoices(view)[0], 1))
    : addMonths(view.filters.month, 1)
  return buildForecast({
    transactions: view.transactions,
    incomePlans: view.incomePlans,
    recurring: view.recurring,
    assumptions: employed ? state.assumptions : view.assumptions,
    debts: view.debts,
    startMonth: start,
    count,
    scenarioId,
  })
}

export function periodLabel(state: AppState): string {
  const name = activeChapter(state) === 'employed' ? 'Full-time' : 'Student life'
  return state.filters.month === 'all' ? name : `${name} · ${monthLabel(state.filters.month)}`
}

export function figuresForMonths(state: AppState, months: string[]) {
  const view = scopeState(state)
  if (activeChapter(view) === 'employed') return foldPlans(view, months.length ? months : employedMonths(view).slice(0, 12))
  if (months.length === 0) return selectedFigures(view)
  let income = 0
  let expense = 0
  let debt = 0
  let incomeKnown = false
  let expenseKnown = false
  let hasRecords = false
  for (const month of months) {
    const figures = monthFigures(view.transactions, month, coverageFor(view, month))
    if (figures.hasRecords) hasRecords = true
    if (figures.incomeCents !== null) { income += figures.incomeCents; incomeKnown = true }
    if (figures.expenseCents !== null) { expense += figures.expenseCents; expenseKnown = true }
    if (figures.debtPaymentCents !== null) debt += figures.debtPaymentCents
  }
  const savings = incomeKnown && expenseKnown ? income - expense - debt : null
  return {
    month: months.join(','),
    hasRecords,
    incomeKnown,
    expenseKnown,
    incomeCents: incomeKnown ? income : null,
    expenseCents: expenseKnown ? expense : null,
    debtPaymentCents: expenseKnown ? debt : null,
    transferCents: null,
    savingsContributionCents: null,
    savingsCents: savings,
    savingsRate: savings !== null && income > 0 ? (savings / income) * 100 : null,
    availableCents: savings,
  }
}

function foldPlans(state: AppState, months: string[]) {
  let income = 0
  let expense = 0
  let incomeKnown = false
  let expenseKnown = false
  let hasRecords = false
  for (const month of months) {
    const figures = planSnapshot(state, month)
    if (figures.hasRecords) hasRecords = true
    if (figures.incomeCents !== null) { income += figures.incomeCents; incomeKnown = true }
    if (figures.expenseCents !== null) { expense += figures.expenseCents; expenseKnown = true }
  }
  const savings = incomeKnown && expenseKnown ? income - expense : null
  return {
    month: months.join(','),
    hasRecords,
    incomeKnown,
    expenseKnown,
    incomeCents: incomeKnown ? income : null,
    expenseCents: expenseKnown ? expense : null,
    debtPaymentCents: 0,
    transferCents: null,
    savingsContributionCents: null,
    savingsCents: savings,
    savingsRate: savings !== null && income > 0 ? (savings / income) * 100 : null,
    availableCents: savings,
  }
}

export const PALETTE = ['#0f7b4c', '#1d4e89', '#9a6700', '#5b4b8a', '#0e7490', '#b45309', '#3f6212', '#64748b', '#9f1239', '#155e75']

export function colorFor(id: string): string {
  let hash = 0
  for (const char of id) hash = (hash * 33 + char.charCodeAt(0)) >>> 0
  return PALETTE[hash % PALETTE.length]
}
