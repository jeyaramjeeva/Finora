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
  if (spentCents === 0) return null
  if (month < current) {
    return spentCents
  }
  if (month === current) {
    const day = asOf.getDate()
    if (day < 1) return null
    return Math.round((spentCents / day) * daysInMonth(month))
  }
  return null
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

export interface ExecutiveBrief {
  month: string
  earnedCents: number | null
  earnedNote: string
  earnedDeltaVsPrior: number | null

  spentCents: number | null
  spentNote: string
  spentDeltaVsPrior: number | null

  savedCents: number | null
  savingsRate: number | null
  savedNote: string

  availableCashCents: number | null
  availableCashNote: string

  topCategories: Array<{ name: string; cents: number; percent: number }>
  topCategoryNote: string

  spendingStatus: 'under' | 'over' | 'on_track' | 'no_budget'
  spendingVsPlanNote: string

  totalDebtCents: number
  debtStatusNote: string

  realisticSavings6mCents: number
  realisticSavings12mCents: number
  savingsOutlookNote: string
}

export function computeExecutiveBrief(params: {
  month: string
  incomeCents: number | null
  expenseCents: number | null
  savingsCents: number | null
  savingsRate: number | null
  debtPaymentCents: number | null
  transferCents: number | null
  savingsContributionCents: number | null
  priorIncomeCents: number | null
  priorExpenseCents: number | null
  topCategories: Array<{ name: string; cents: number }>
  budgetSummary: { remaining: number | null; over: boolean; count: number }
  debtCents: number
  trailingExpenseAvgCents: number | null
  isEmployed: boolean
}): ExecutiveBrief {
  const {
    month,
    incomeCents,
    expenseCents,
    savingsCents,
    savingsRate,
    debtPaymentCents,
    savingsContributionCents,
    priorIncomeCents,
    priorExpenseCents,
    topCategories,
    budgetSummary,
    debtCents,
    trailingExpenseAvgCents,
    isEmployed,
  } = params

  const earnedDeltaVsPrior = previousMonthDelta(incomeCents, priorIncomeCents)
  const spentDeltaVsPrior = previousMonthDelta(expenseCents, priorExpenseCents)

  // 1. Earned
  const earnedNote = isEmployed
    ? 'Estimated gross €4,320.82 / net salary from Trimble full-time plan.'
    : incomeCents !== null
      ? 'Actual earnings from student employment & received allowances.'
      : 'No income recorded for this period.'

  // 2. Spent
  const spentNote = expenseCents !== null
    ? 'Actual living expenses. Transfers and account withdrawals are excluded.'
    : 'No expenses recorded.'

  // 3. Saved
  const savedNote = savingsCents !== null && savingsCents >= 0
    ? `Saved ${savingsRate !== null ? `${savingsRate.toFixed(1)}%` : ''} of income after expenses & debt.`
    : savingsCents !== null
      ? 'Expenses exceeded income in this period.'
      : 'Savings unknown.'

  // 4. Available cash
  const availableCashCents = incomeCents !== null && expenseCents !== null
    ? Math.max(0, incomeCents - expenseCents - (debtPaymentCents ?? 0) - (savingsContributionCents ?? 0))
    : null
  const availableCashNote = availableCashCents !== null
    ? 'Net liquid buffer remaining in your account after all expenses, debt repayments, and savings contributions.'
    : 'Available buffer cannot be determined.'

  // 5. Where does most money go?
  const totalCategorySpend = topCategories.reduce((acc, cat) => acc + cat.cents, 0)
  const formattedTopCategories = topCategories.slice(0, 3).map((cat) => ({
    name: cat.name,
    cents: cat.cents,
    percent: totalCategorySpend > 0 ? (cat.cents / totalCategorySpend) * 100 : 0,
  }))
  const topCategoryNote = formattedTopCategories.length
    ? `#1 ${formattedTopCategories[0].name} (${formattedTopCategories[0].percent.toFixed(0)}%), followed by ${formattedTopCategories.slice(1).map((c) => `${c.name} (${c.percent.toFixed(0)}%)`).join(', ')}`
    : 'No categorized spending recorded.'

  // 6. Spending vs planned
  let spendingStatus: 'under' | 'over' | 'on_track' | 'no_budget' = 'no_budget'
  let spendingVsPlanNote = 'No monthly budget set for this period.'
  if (budgetSummary.count > 0 && budgetSummary.remaining !== null) {
    if (budgetSummary.over) {
      spendingStatus = 'over'
      spendingVsPlanNote = `Exceeded set budget by €${(Math.abs(budgetSummary.remaining) / 100).toFixed(2)} across ${budgetSummary.count} budgeted categories.`
    } else {
      spendingStatus = 'under'
      spendingVsPlanNote = `Under budget by €${(budgetSummary.remaining / 100).toFixed(2)} across ${budgetSummary.count} budgeted categories.`
    }
  } else if (expenseCents !== null && trailingExpenseAvgCents !== null && trailingExpenseAvgCents > 0) {
    const diff = expenseCents - trailingExpenseAvgCents
    if (diff > 5000) {
      spendingStatus = 'over'
      spendingVsPlanNote = `€${(Math.abs(diff) / 100).toFixed(2)} higher than your 3-month trailing average (€${(trailingExpenseAvgCents / 100).toFixed(2)}).`
    } else if (diff < -5000) {
      spendingStatus = 'under'
      spendingVsPlanNote = `€${(Math.abs(diff) / 100).toFixed(2)} lower than your 3-month trailing average (€${(trailingExpenseAvgCents / 100).toFixed(2)}).`
    } else {
      spendingStatus = 'on_track'
      spendingVsPlanNote = `Consistent with your 3-month trailing average (€${(trailingExpenseAvgCents / 100).toFixed(2)}).`
    }
  }

  // 7. Outstanding debt
  const debtStatusNote = debtCents > 0
    ? `€${(debtCents / 100).toFixed(2)} outstanding principal balance (Appa loan). Anna student debt is 100% completed (€2 overpaid).`
    : 'No outstanding debt recorded. Anna loan is completed.'

  // 8. Realistic 6 to 12 month savings
  let realisticSavings6mCents = 0
  let realisticSavings12mCents = 0
  let savingsOutlookNote = ''
  if (isEmployed) {
    // 600 EUR/mo planned savings (SIP 200 + Indian SIP 200 + Gold 100 + Emergency 100)
    realisticSavings6mCents = 60000 * 6
    realisticSavings12mCents = 60000 * 12
    savingsOutlookNote = 'Based on full-time plan: €600/month across ETF SIP, Indian SIP, Gold, and Emergency Fund, plus up to €1,696/month unallocated cash buffer.'
  } else {
    // Student run rate savings
    const monthlyRate = savingsCents !== null && savingsCents > 0 ? savingsCents : 11000 // default ~110 EUR/mo
    realisticSavings6mCents = monthlyRate * 6
    realisticSavings12mCents = monthlyRate * 12
    savingsOutlookNote = `Projected at ~€${(monthlyRate / 100).toFixed(0)}/month based on recent actual savings rate and thesis student income.`
  }

  return {
    month,
    earnedCents: incomeCents,
    earnedNote,
    earnedDeltaVsPrior,
    spentCents: expenseCents,
    spentNote,
    spentDeltaVsPrior,
    savedCents: savingsCents,
    savingsRate,
    savedNote,
    availableCashCents,
    availableCashNote,
    topCategories: formattedTopCategories,
    topCategoryNote,
    spendingStatus,
    spendingVsPlanNote,
    totalDebtCents: debtCents,
    debtStatusNote,
    realisticSavings6mCents,
    realisticSavings12mCents,
    savingsOutlookNote,
  }
}
