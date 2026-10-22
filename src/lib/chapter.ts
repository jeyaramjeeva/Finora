import { addMonths, monthsBetween } from './dates'
import { estimatePayslip, plannedSip, rulesForMonth, shareRate } from './forecast'
import { toCents } from './money'
import type { AppState, Bill, Chapter, Debt, Goal, IncomePlan, RecurringRule, Transaction } from './types'

export function chapterFromSheet(sheet?: string): Chapter | null {
  if (!sheet) return null
  const name = sheet.toLowerCase()
  if (name.includes('student')) return 'student'
  if (name.includes('full')) return 'employed'
  if (name.includes('repay')) return 'student'
  return null
}

export function chapterOf(record: { chapter?: Chapter; sourceSheet?: string; source?: string; id?: string }): Chapter {
  if (record.chapter) return record.chapter
  const fromSheet = chapterFromSheet(record.sourceSheet)
  if (fromSheet) return fromSheet
  if (record.id?.startsWith('bill:detected')) return 'student'
  if (record.id?.startsWith('bill:plan') || record.id?.startsWith('income:')) return 'employed'
  if (record.id?.startsWith('goal:') && record.source === 'workbook') return 'employed'
  if (record.id?.startsWith('debt:') && record.source !== 'manual') return 'student'
  return 'student'
}

export function activeChapter(state: AppState): Chapter {
  return state.filters.chapter ?? 'student'
}

export function scopeState(state: AppState): AppState {
  const chapter = activeChapter(state)
  const keep = <T extends { chapter?: Chapter; sourceSheet?: string; source?: string; id?: string }>(rows: T[]) => rows.filter((row) => chapterOf(row) === chapter)
  return {
    ...state,
    transactions: keep(state.transactions),
    recurring: keep(state.recurring),
    debts: keep(state.debts as Array<Debt & { id: string }>),
    goals: keep(state.goals),
    incomePlans: keep(state.incomePlans),
    bills: keep(state.bills),
    reconciliation: chapter === 'student' ? state.reconciliation : [],
    assumptions: chapter === 'student'
      ? { ...state.assumptions, accounts: [], planStart: null, planEnd: null, horizonNotes: [] }
      : state.assumptions,
  }
}

export function employedMonths(state: AppState): string[] {
  const start = state.assumptions.planStart
  if (!start) return []
  return monthsBetween(start, addMonths(start, 23))
}

export function planSnapshot(state: AppState, month: string) {
  const plan = state.incomePlans.find((item) => month >= item.startMonth && month <= item.endMonth) ?? null
  const payslip = plan ? estimatePayslip(plan.grossMonthlyCents, state.assumptions.rates) : null
  const expenses = rulesForMonth(state.recurring, month, 'expense')
  const savingsRules = rulesForMonth(state.recurring, month, 'savings_contribution')
  const incomeCents = payslip?.netCents ?? null
  const expenseCents = plan || expenses.length ? expenses.reduce((sum, rule) => sum + rule.amountCents, 0) : null
  let savingsTransferCents = savingsRules.reduce((sum, rule) => sum + rule.amountCents, 0)
  if (plan && payslip && state.assumptions.targetSavingsRate > 0) {
    const share = payslip.unroundedNetEuros * shareRate(state.assumptions, month)
    const gold = (savingsRules.find((rule) => /gold/i.test(rule.name))?.amountCents ?? 0) / 100
    const emergency = (savingsRules.find((rule) => /emergency/i.test(rule.name))?.amountCents ?? 0) / 100
    const sip = plannedSip(payslip.unroundedNetEuros, gold, emergency, share, state.assumptions.targetSavingsRate, state.assumptions.sipRoundToEuros || 50)
    savingsTransferCents = toCents(gold + emergency + share + sip.sipEuros + sip.indianEuros)
  }
  const savingsCents = incomeCents !== null && expenseCents !== null ? incomeCents - expenseCents : null
  return {
    month,
    hasRecords: Boolean(plan || expenses.length),
    incomeKnown: incomeCents !== null,
    expenseKnown: expenseCents !== null,
    incomeCents,
    expenseCents,
    debtPaymentCents: 0,
    transferCents: null,
    savingsContributionCents: savingsTransferCents,
    savingsCents,
    savingsRate: savingsCents !== null && incomeCents ? (savingsCents / incomeCents) * 100 : null,
    availableCents: savingsCents !== null ? savingsCents - savingsTransferCents : null,
    expenses,
  }
}

export function planCategoryTotals(state: AppState, months: string[]): Array<{ id: string; cents: number }> {
  const totals = new Map<string, number>()
  for (const month of months) {
    for (const rule of rulesForMonth(state.recurring, month, 'expense')) {
      totals.set(rule.categoryId, (totals.get(rule.categoryId) ?? 0) + rule.amountCents)
    }
  }
  return [...totals.entries()].map(([id, cents]) => ({ id, cents })).sort((a, b) => b.cents - a.cents)
}

export type ChapterRecord = Transaction | RecurringRule | Debt | Goal | IncomePlan | Bill
