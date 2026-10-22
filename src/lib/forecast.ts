import { addMonths, monthsBetween } from './dates'
import { debtDisplayedBalance, monthFigures } from './calc'
import { toCents } from './money'
import type { Assumptions, Debt, IncomePlan, RecurringRule, Transaction } from './types'

export interface PayslipLine {
  key: string
  label: string
  rate: number
  cents: number
}

export interface PayslipEstimate {
  grossCents: number
  lines: PayslipLine[]
  deductionCents: number
  netCents: number
  deductionPercent: number | null
  unroundedNetEuros: number
}

export function estimatePayslip(grossCents: number, rates: Assumptions['rates']): PayslipEstimate {
  const gross = grossCents / 100
  const specs = [
    ['incomeTax', 'Income tax', rates.incomeTax],
    ['pension', 'Pension contribution', rates.pension],
    ['unemployment', 'Unemployment insurance', rates.unemployment],
    ['health', 'Health insurance', rates.health],
    ['longTermCare', 'Long-term care insurance', rates.longTermCare],
  ] as const
  const unrounded = specs.map(([, , rate]) => gross * rate)
  const lines: PayslipLine[] = specs.map(([key, label, rate], index) => ({
    key,
    label,
    rate,
    cents: toCents(unrounded[index]),
  }))
  const deductionCents = lines.reduce((sum, line) => sum + line.cents, 0)
  const unroundedNetEuros = gross - unrounded.reduce((sum, value) => sum + value, 0)
  return {
    grossCents,
    lines,
    deductionCents,
    netCents: grossCents - deductionCents,
    deductionPercent: grossCents > 0 ? (deductionCents / grossCents) * 100 : null,
    unroundedNetEuros,
  }
}

export function excelRound(value: number): number {
  const sign = value < 0 ? -1 : 1
  return sign * Math.round(Math.abs(value))
}

export function plannedSip(netEuros: number, goldEuros: number, emergencyEuros: number, shareEuros: number, targetRate: number, stepEuros: number): { sipEuros: number; indianEuros: number } {
  const pool = netEuros * targetRate
  const half = Math.max(0, (pool - goldEuros - emergencyEuros - shareEuros) / 2)
  const sipEuros = excelRound(half / stepEuros) * stepEuros
  const indianBase = Math.max(0, pool - sipEuros - goldEuros - emergencyEuros - shareEuros)
  const indianEuros = excelRound(indianBase / stepEuros) * stepEuros
  return { sipEuros, indianEuros }
}

export function shareRate(assumptions: Assumptions, month: string): number {
  const segment = assumptions.shareSegments.find((item) => month >= item.startMonth && month <= item.endMonth)
  return segment?.rate ?? 0
}

export function incomePlanFor(plans: IncomePlan[], month: string): IncomePlan | null {
  return plans.find((plan) => month >= plan.startMonth && month <= plan.endMonth) ?? null
}

export function rulesForMonth(rules: RecurringRule[], month: string, kind?: RecurringRule['kind']): RecurringRule[] {
  return rules.filter((rule) => {
    if (kind && rule.kind !== kind) return false
    if (month < rule.startMonth) return false
    if (rule.endMonth && month > rule.endMonth) return false
    return true
  })
}

export interface ScenarioCopy {
  id: 'conservative' | 'expected' | 'optimistic'
  label: string
  incomeFactor: number
  expenseFactor: number
  summary: string
}

export const SCENARIOS: ScenarioCopy[] = [
  {
    id: 'conservative',
    label: 'Conservative',
    incomeFactor: 0.95,
    expenseFactor: 1.1,
    summary: 'Income 5% below the base and living costs 10% above it. Debt payments and planned savings transfers are not scaled.',
  },
  {
    id: 'expected',
    label: 'Expected',
    incomeFactor: 1,
    expenseFactor: 1,
    summary: 'Uses the workbook plan where it exists, and the recent actual average where the workbook has a gap.',
  },
  {
    id: 'optimistic',
    label: 'Optimistic',
    incomeFactor: 1.05,
    expenseFactor: 0.95,
    summary: 'Income 5% above the base and living costs 5% below it. This is not a forecast of a raise.',
  },
]

export interface ForecastMonth {
  month: string
  incomeCents: number | null
  expenseCents: number | null
  savingsTransferCents: number | null
  debtPaymentCents: number | null
  cashFlowCents: number | null
  debtBalanceCents: number | null
  incomeSource: string
  expenseSource: string
  notes: string[]
  limited: boolean
}

export interface ForecastModel {
  months: ForecastMonth[]
  assumptions: string[]
  scenario: ScenarioCopy
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function lastActualMonths(transactions: Transaction[], count: number): string[] {
  const months = [...new Set(transactions.filter((transaction) => transaction.origin === 'actual').map((transaction) => transaction.date.slice(0, 7)))]
  return months.sort().slice(-count)
}

export function buildForecast(input: {
  transactions: Transaction[]
  incomePlans: IncomePlan[]
  recurring: RecurringRule[]
  assumptions: Assumptions
  debts: Debt[]
  startMonth: string
  count: number
  scenarioId: ScenarioCopy['id']
}): ForecastModel {
  const scenario = SCENARIOS.find((item) => item.id === input.scenarioId) ?? SCENARIOS[1]
  const sampleMonths = lastActualMonths(input.transactions, 3)
  const sampleFigures = sampleMonths.map((month) => monthFigures(input.transactions, month, { incomeKnown: true, expenseKnown: true }))
  const runIncome = input.assumptions.manualRunRateIncomeCents ?? average(sampleFigures.map((figure) => figure.incomeCents ?? 0).filter((_, index) => sampleFigures[index].incomeCents !== null))
  const runExpense = input.assumptions.manualRunRateExpenseCents ?? average(sampleFigures.map((figure) => figure.expenseCents ?? 0).filter((_, index) => sampleFigures[index].expenseCents !== null))
  const notes = [
    'Projections are scenarios, not guaranteed results.',
    'Salary deductions in the full-time plan are percentage formulas. They are estimates, not payslip calculations.',
    sampleMonths.length
      ? `The recent run-rate uses ${sampleMonths.join(', ')}.`
      : 'There is not enough actual history to build a run-rate.',
    'Transfers into savings are not counted as living expenses.',
    'Student-era insurance is not added on top of the employed net salary, because that plan already deducts health and long-term care insurance.',
    'The full-time sheet leaves many categories at zero. Those zeros are omitted. Variable costs fall back to the recent average when a category is absent from the plan.',
  ]
  if (input.assumptions.manualRunRateIncomeCents !== null || input.assumptions.manualRunRateExpenseCents !== null) {
    notes.push('A manual run-rate override is active for months the workbook does not plan.')
  }
  const outstanding = input.debts.reduce((sum, debt) => sum + Math.max(0, debtDisplayedBalance(debt).cents ?? 0), 0)
  const debtKnown = input.debts.every((debt) => debt.minimumPaymentCents !== null && debt.interestRateAnnual !== null)
  let debtBalance = outstanding
  const months = monthsBetween(input.startMonth, addMonths(input.startMonth, input.count - 1)).map((month) => {
    const plan = incomePlanFor(input.incomePlans, month)
    const plannedExpenses = rulesForMonth(input.recurring, month, 'expense')
    const plannedSavings = rulesForMonth(input.recurring, month, 'savings_contribution')
    const rowNotes: string[] = []
    let incomeCents: number | null = null
    let incomeSource = 'No income assumption'
    if (plan) {
      const payslip = estimatePayslip(plan.grossMonthlyCents, input.assumptions.rates)
      incomeCents = Math.round(payslip.netCents * scenario.incomeFactor)
      incomeSource = `${plan.employer || plan.name} plan, estimated net`
      rowNotes.push('Net pay is estimated from workbook percentages.')
    } else if (runIncome !== null) {
      incomeCents = Math.round(runIncome * scenario.incomeFactor)
      incomeSource = input.assumptions.manualRunRateIncomeCents !== null ? 'Manual income assumption' : 'Average of recent actual months'
      rowNotes.push('This month is not covered by the salary plan.')
    }

    let expenseCents: number | null = null
    let expenseSource = 'No expense assumption'
    if (plan && plannedExpenses.length) {
      const plannedGroups = new Set(plannedExpenses.map((rule) => rule.categoryId))
      const historical = historicalCategoryAverage(input.transactions, sampleMonths)
      let variable = 0
      let usedHistory = false
      for (const [categoryId, cents] of historical) {
        if (plannedGroups.has(categoryId)) continue
        if (isInsurance(categoryId)) continue
        if (isTransport(categoryId) && plannedExpenses.some((rule) => isTransport(rule.categoryId))) continue
        variable += cents
        usedHistory = true
      }
      const planned = plannedExpenses.reduce((sum, rule) => sum + rule.amountCents, 0)
      expenseCents = Math.round((planned + variable) * scenario.expenseFactor)
      expenseSource = usedHistory ? 'Workbook plan plus recent average for categories it does not list' : 'Workbook plan only'
      rowNotes.push('Planned zeros were not treated as confirmed spending.')
    } else if (runExpense !== null) {
      expenseCents = Math.round(runExpense * scenario.expenseFactor)
      expenseSource = input.assumptions.manualRunRateExpenseCents !== null ? 'Manual expense assumption' : 'Average of recent actual months'
    }

    const savingsFixed = plannedSavings.reduce((sum, rule) => sum + rule.amountCents, 0)
    let savingsTransferCents: number | null = plan ? savingsFixed : null
    if (plan && input.assumptions.targetSavingsRate > 0) {
      const payslip = estimatePayslip(plan.grossMonthlyCents, input.assumptions.rates)
      const share = payslip.unroundedNetEuros * shareRate(input.assumptions, month)
      const gold = (plannedSavings.find((rule) => /gold/i.test(rule.name))?.amountCents ?? 0) / 100
      const emergency = (plannedSavings.find((rule) => /emergency/i.test(rule.name))?.amountCents ?? 0) / 100
      const sip = plannedSip(
        payslip.unroundedNetEuros,
        gold,
        emergency,
        share,
        input.assumptions.targetSavingsRate,
        input.assumptions.sipRoundToEuros || 50,
      )
      savingsTransferCents = toCents(gold + emergency + share + sip.sipEuros + sip.indianEuros)
      rowNotes.push('SIP amounts follow the workbook rounding formula and are estimates.')
    }

    let debtPaymentCents: number | null = null
    if (input.debts.length === 0) {
      debtPaymentCents = 0
    } else if (!debtKnown) {
      debtPaymentCents = null
      rowNotes.push('Debt payments are unknown until a minimum payment is entered.')
    } else {
      debtPaymentCents = input.debts.reduce((sum, debt) => sum + (debt.minimumPaymentCents ?? 0), 0)
      if (debtBalance > 0) {
        const interest = input.debts.reduce((sum, debt) => {
          const balance = Math.max(0, debtDisplayedBalance(debt).cents ?? 0)
          return sum + Math.round(balance * ((debt.interestRateAnnual ?? 0) / 100 / 12))
        }, 0)
        debtBalance = Math.max(0, debtBalance + interest - debtPaymentCents)
      }
    }

    const limited = incomeCents === null || expenseCents === null
    const cashFlowCents = !limited && debtPaymentCents !== null && savingsTransferCents !== null
      ? incomeCents! - expenseCents! - debtPaymentCents - savingsTransferCents
      : !limited && debtPaymentCents === null
        ? null
        : !limited
          ? incomeCents! - expenseCents! - (savingsTransferCents ?? 0)
          : null
    return {
      month,
      incomeCents,
      expenseCents,
      savingsTransferCents,
      debtPaymentCents,
      cashFlowCents,
      debtBalanceCents: debtKnown ? debtBalance : null,
      incomeSource,
      expenseSource,
      notes: rowNotes,
      limited,
    }
  })
  return { months, assumptions: notes, scenario }
}

function historicalCategoryAverage(transactions: Transaction[], months: string[]): Map<string, number> {
  const totals = new Map<string, number>()
  if (months.length === 0) return totals
  for (const month of months) {
    for (const transaction of transactions) {
      if (transaction.origin !== 'actual' || transaction.kind !== 'expense') continue
      if (transaction.date.slice(0, 7) !== month) continue
      totals.set(transaction.categoryId, (totals.get(transaction.categoryId) ?? 0) + transaction.amountCents)
    }
  }
  for (const [key, value] of totals) totals.set(key, Math.round(value / months.length))
  return totals
}

function isInsurance(categoryId: string): boolean {
  return categoryId.includes('insurance')
}

function isTransport(categoryId: string): boolean {
  return /travel|ticket|deutschland|trip|transport/.test(categoryId)
}
