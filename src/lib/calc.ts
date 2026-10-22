import { daysInMonth, monthKey, monthsBetween } from './dates'
import { sumCents } from './money'
import type { Budget, Debt, Transaction, TxKind } from './types'

export interface MonthFigures {
  month: string
  hasRecords: boolean
  incomeKnown: boolean
  expenseKnown: boolean
  incomeCents: number | null
  expenseCents: number | null
  debtPaymentCents: number | null
  transferCents: number | null
  savingsContributionCents: number | null
  savingsCents: number | null
  savingsRate: number | null
  availableCents: number | null
}

export interface CoverageHint {
  incomeKnown: boolean
  expenseKnown: boolean
}

function total(transactions: Transaction[], kind: TxKind): number {
  return sumCents(transactions.filter((transaction) => transaction.kind === kind).map((transaction) => transaction.amountCents))
}

export function monthFigures(
  transactions: Transaction[],
  month: string,
  coverage?: CoverageHint,
  origin: 'actual' | 'forecast' | 'all' = 'actual',
): MonthFigures {
  const rows = transactions.filter((transaction) => {
    if (monthKey(transaction.date) !== month) return false
    if (origin !== 'all' && transaction.origin !== origin) return false
    return true
  })
  const incomeKnown = coverage?.incomeKnown ?? rows.some((row) => row.kind === 'income')
  const expenseKnown = coverage?.expenseKnown ?? rows.some((row) => row.kind === 'expense' || row.kind === 'debt_payment')
  if (rows.length === 0 && !incomeKnown && !expenseKnown) {
    return {
      month,
      hasRecords: false,
      incomeKnown: false,
      expenseKnown: false,
      incomeCents: null,
      expenseCents: null,
      debtPaymentCents: null,
      transferCents: null,
      savingsContributionCents: null,
      savingsCents: null,
      savingsRate: null,
      availableCents: null,
    }
  }
  const incomeCents = incomeKnown ? total(rows, 'income') : null
  const expenseCents = expenseKnown ? total(rows, 'expense') : null
  const debtPaymentCents = rows.some((row) => row.kind === 'debt_payment') || expenseKnown ? total(rows, 'debt_payment') : null
  const transferCents = total(rows, 'transfer')
  const savingsContributionCents = total(rows, 'savings_contribution')
  const savingsCents = incomeCents !== null && expenseCents !== null && debtPaymentCents !== null
    ? incomeCents - expenseCents - debtPaymentCents
    : null
  const savingsRate = savingsCents !== null && incomeCents !== null && incomeCents > 0
    ? (savingsCents / incomeCents) * 100
    : incomeCents === 0
      ? null
      : null
  const availableCents = savingsCents
  return {
    month,
    hasRecords: rows.length > 0 || incomeKnown || expenseKnown,
    incomeKnown,
    expenseKnown,
    incomeCents,
    expenseCents,
    debtPaymentCents,
    transferCents,
    savingsContributionCents,
    savingsCents,
    savingsRate,
    availableCents,
  }
}

export function budgetRemaining(budgetCents: number, spentCents: number): number {
  return budgetCents - spentCents
}

export function budgetUtilisation(budgetCents: number, spentCents: number): number | null {
  if (budgetCents <= 0) return null
  return (spentCents / budgetCents) * 100
}

export function eligibleSpend(transactions: Transaction[], categoryId: string, period: { month?: string; year?: number }): number {
  return sumCents(
    transactions
      .filter((transaction) => {
        if (transaction.kind !== 'expense' || transaction.origin !== 'actual') return false
        if (transaction.categoryId !== categoryId) return false
        if (period.month && monthKey(transaction.date) !== period.month) return false
        if (period.year && Number(transaction.date.slice(0, 4)) !== period.year) return false
        return true
      })
      .map((transaction) => transaction.amountCents),
  )
}

export function projectMonthEnd(spentCents: number, month: string, asOf: Date): number | null {
  const current = `${asOf.getFullYear()}-${String(asOf.getMonth() + 1).padStart(2, '0')}`
  if (month !== current) return null
  if (spentCents === 0) return null
  const day = asOf.getDate()
  if (day < 1) return null
  return Math.round((spentCents / day) * daysInMonth(month))
}

export function netWorth(assetsCents: Array<number | null>, liabilityCents: Array<number | null>): number | null {
  if (assetsCents.length === 0 || liabilityCents.length === 0) return null
  if (assetsCents.some((value) => value === null) || liabilityCents.some((value) => value === null)) return null
  return sumCents(assetsCents as number[]) - sumCents(liabilityCents as number[])
}

export function debtWorkbookBalance(debt: Debt): number {
  const opening = sumCents(debt.components.map((component) => component.amountCents))
  const interest = sumCents(debt.payments.map((payment) => payment.interestCents))
  const paid = sumCents(debt.payments.map((payment) => payment.amountCents))
  return opening + interest - paid
}

export function debtDisplayedBalance(debt: Debt): { cents: number | null; confirmed: boolean } {
  if (debt.confirmedBalanceCents !== null) return { cents: debt.confirmedBalanceCents, confirmed: true }
  return { cents: debtWorkbookBalance(debt), confirmed: false }
}

export function outstandingDebt(debts: Debt[]): { cents: number; unconfirmed: boolean; hasNegative: boolean } {
  let cents = 0
  let unconfirmed = false
  let hasNegative = false
  for (const debt of debts) {
    const displayed = debtDisplayedBalance(debt)
    if (!displayed.confirmed) unconfirmed = true
    if (displayed.cents === null) continue
    if (displayed.cents < 0) {
      hasNegative = true
      continue
    }
    cents += displayed.cents
  }
  return { cents, unconfirmed, hasNegative }
}

export interface PayoffResult {
  ok: boolean
  reason?: string
  months?: number
  debtFreeMonth?: string
  interestCents?: number
  order?: string[]
}

export function projectSingleDebt(balanceCents: number, annualPercent: number, paymentCents: number, maxMonths = 600): PayoffResult {
  if (balanceCents <= 0) return { ok: true, months: 0, interestCents: 0 }
  if (paymentCents <= 0) return { ok: false, reason: 'Payment must be greater than zero.' }
  const monthlyRate = annualPercent / 100 / 12
  let balance = balanceCents
  let interestPaid = 0
  for (let month = 1; month <= maxMonths; month += 1) {
    const interest = Math.round(balance * monthlyRate)
    if (paymentCents <= interest) {
      return { ok: false, reason: 'The payment does not cover interest, so this balance does not fall.' }
    }
    const principal = Math.min(balance, paymentCents - interest)
    interestPaid += interest
    balance -= principal
    if (balance <= 0) return { ok: true, months: month, interestCents: interestPaid }
  }
  return { ok: false, reason: 'Payoff is longer than 50 years under these assumptions.' }
}

export function repaymentScenario(
  debts: Debt[],
  method: 'avalanche' | 'snowball',
  extraCents: number,
  startMonth: string,
): PayoffResult {
  const active = debts
    .map((debt) => {
      const balance = debtDisplayedBalance(debt).cents ?? 0
      return {
        name: debt.name,
        balance: Math.max(0, balance),
        rate: debt.interestRateAnnual,
        minimum: debt.minimumPaymentCents,
      }
    })
    .filter((debt) => debt.balance > 0)
  if (active.length === 0) return { ok: true, months: 0, interestCents: 0, order: [], debtFreeMonth: startMonth }
  if (active.some((debt) => debt.rate === null || debt.minimum === null)) {
    return {
      ok: false,
      reason: 'Enter an interest rate and a minimum payment for every debt with a balance. The workbook does not contain those terms.',
    }
  }
  const state = active.map((debt) => ({
    ...debt,
    rate: debt.rate as number,
    minimum: debt.minimum as number,
  }))
  let months = 0
  let interestPaid = 0
  const finished: string[] = []
  while (state.some((debt) => debt.balance > 0) && months < 600) {
    months += 1
    const order = [...state].filter((debt) => debt.balance > 0).sort((a, b) => {
      if (method === 'avalanche') return b.rate - a.rate || a.balance - b.balance
      return a.balance - b.balance || b.rate - a.rate
    })
    let extra = extraCents
    for (const debt of state) {
      if (debt.balance <= 0) continue
      const interest = Math.round(debt.balance * (debt.rate / 100 / 12))
      interestPaid += interest
      debt.balance += interest
      const pay = Math.min(debt.balance, debt.minimum)
      debt.balance -= pay
    }
    for (const target of order) {
      if (extra <= 0) break
      const live = state.find((debt) => debt.name === target.name)
      if (!live || live.balance <= 0) continue
      const pay = Math.min(live.balance, extra)
      live.balance -= pay
      extra -= pay
    }
    for (const debt of state) {
      if (debt.balance <= 0 && !finished.includes(debt.name)) finished.push(debt.name)
    }
    if (state.every((debt) => debt.balance <= 0)) {
      return { ok: true, months, interestCents: interestPaid, order: finished, debtFreeMonth: monthsBetween(startMonth, startMonth).length ? addMonthSafe(startMonth, months - 1) : startMonth }
    }
  }
  return { ok: false, reason: 'These payments do not clear the balances within 50 years.' }
}

function addMonthSafe(month: string, count: number): string {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, m - 1 + count, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function totalsByCategory(transactions: Transaction[], kind: TxKind = 'expense'): Map<string, number> {
  const totals = new Map<string, number>()
  for (const transaction of transactions) {
    if (transaction.kind !== kind) continue
    totals.set(transaction.categoryId, (totals.get(transaction.categoryId) ?? 0) + transaction.amountCents)
  }
  return totals
}

export function filterTransactions(transactions: Transaction[], filters: {
  month?: string
  categoryId?: string
  kind?: 'all' | TxKind
  origin?: 'all' | 'actual' | 'forecast'
  from?: string
  to?: string
}): Transaction[] {
  return transactions.filter((transaction) => {
    if (filters.month && filters.month !== 'all' && monthKey(transaction.date) !== filters.month) return false
    if (filters.categoryId && filters.categoryId !== 'all' && transaction.categoryId !== filters.categoryId) return false
    if (filters.kind && filters.kind !== 'all' && transaction.kind !== filters.kind) return false
    if (filters.origin && filters.origin !== 'all' && transaction.origin !== filters.origin) return false
    if (filters.from && transaction.date < filters.from) return false
    if (filters.to && transaction.date > filters.to) return false
    return true
  })
}

export function previousMonthDelta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null
  return current - previous
}

export function budgetStatus(utilisation: number | null): 'none' | 'ok' | 'watch' | 'high' | 'over' {
  if (utilisation === null) return 'none'
  if (utilisation >= 100) return 'over'
  if (utilisation >= 90) return 'high'
  if (utilisation >= 75) return 'watch'
  return 'ok'
}

export function applyBudget(budget: Budget, transactions: Transaction[], month: string): {
  spentCents: number
  remainingCents: number
  utilisation: number | null
  projectedCents: number | null
} {
  const year = Number(month.slice(0, 4))
  const spentCents = budget.period === 'year'
    ? eligibleSpend(transactions, budget.categoryId, { year })
    : eligibleSpend(transactions, budget.categoryId, { month })
  return {
    spentCents,
    remainingCents: budgetRemaining(budget.amountCents, spentCents),
    utilisation: budgetUtilisation(budget.amountCents, spentCents),
    projectedCents: budget.period === 'month' ? projectMonthEnd(spentCents, month, new Date()) : null,
  }
}
