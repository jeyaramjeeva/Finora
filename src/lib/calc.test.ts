import { describe, expect, it } from 'vitest'
import {
  budgetRemaining,
  budgetUtilisation,
  debtWorkbookBalance,
  filterTransactions,
  monthFigures,
  netWorth,
  outstandingDebt,
  projectMonthEnd,
  projectSingleDebt,
  repaymentScenario,
  totalsByCategory,
} from './calc'
import { findDuplicateGroups } from './duplicates'
import { parseAmount, toCents } from './money'
import type { Debt, Transaction } from './types'

function tx(partial: Partial<Transaction> & Pick<Transaction, 'amountCents' | 'kind' | 'date'>): Transaction {
  return {
    id: partial.id ?? `${partial.date}-${partial.kind}-${partial.amountCents}`,
    dayKnown: true,
    description: partial.description ?? 'Item',
    categoryId: partial.categoryId ?? 'rent',
    account: '',
    notes: '',
    origin: partial.origin ?? 'actual',
    confidence: 'confirmed',
    source: 'manual',
    recurring: false,
    ...partial,
  }
}

describe('money and month figures', () => {
  it('rounds currency to cents', () => {
    expect(toCents(236.24)).toBe(23624)
    expect(toCents(1.69)).toBe(169)
    expect(toCents(8.45)).toBe(845)
    expect(parseAmount('1.234,50')).toBe(123450)
    expect(parseAmount('12.50')).toBe(1250)
  })

  it('calculates savings only when income and expenses are known', () => {
    const rows = [
      tx({ date: '2026-02-01', kind: 'income', amountCents: 130100, categoryId: 'earnings' }),
      tx({ date: '2026-02-03', kind: 'expense', amountCents: 40600, categoryId: 'rent' }),
      tx({ date: '2026-02-04', kind: 'expense', amountCents: -500, categoryId: 'groceries' }),
      tx({ date: '2026-02-05', kind: 'transfer', amountCents: 10000, categoryId: 'withdraw' }),
      tx({ date: '2026-02-06', kind: 'debt_payment', amountCents: 2000, categoryId: 'repay' }),
      tx({ date: '2026-02-07', kind: 'savings_contribution', amountCents: 5000, categoryId: 'gold' }),
    ]
    const figures = monthFigures(rows, '2026-02', { incomeKnown: true, expenseKnown: true })
    expect(figures.incomeCents).toBe(130100)
    expect(figures.expenseCents).toBe(40100)
    expect(figures.savingsCents).toBe(130100 - 40100 - 2000)
    expect(figures.savingsRate).toBeCloseTo(((130100 - 40100 - 2000) / 130100) * 100)
    expect(figures.transferCents).toBe(10000)
    expect(monthFigures(rows, '2026-03').incomeCents).toBeNull()
    expect(monthFigures([], '2026-02', { incomeKnown: true, expenseKnown: true }).incomeCents).toBe(0)
    expect(monthFigures([tx({ date: '2026-02-01', kind: 'expense', amountCents: 100, categoryId: 'rent' })], '2026-02').savingsRate).toBeNull()
  })

  it('keeps budget maths and date filters consistent', () => {
    expect(budgetRemaining(10000, 7500)).toBe(2500)
    expect(budgetUtilisation(10000, 7500)).toBe(75)
    expect(budgetUtilisation(0, 100)).toBeNull()
    const rows = [
      tx({ date: '2026-02-01', kind: 'expense', amountCents: 1000, categoryId: 'rent' }),
      tx({ date: '2026-03-01', kind: 'expense', amountCents: 2000, categoryId: 'food' }),
      tx({ date: '2026-02-01', kind: 'expense', amountCents: 3000, categoryId: 'rent', origin: 'forecast' }),
    ]
    expect(filterTransactions(rows, { month: '2026-02', origin: 'actual' })).toHaveLength(1)
    expect(totalsByCategory(filterTransactions(rows, { origin: 'actual' })).get('rent')).toBe(1000)
    expect(projectMonthEnd(10000, '2026-10', new Date(2026, 9, 10))).toBe(31000)
    expect(projectMonthEnd(0, '2026-10', new Date(2026, 9, 10))).toBeNull()
  })
})

describe('debt', () => {
  const debt: Debt = {
    id: 'debt:anna',
    name: 'Anna',
    components: [{ id: 'a', name: 'Fee', amountCents: 439500 }],
    payments: [{ id: 'p', amountCents: 439700, principalCents: 439700, interestCents: 0, date: null, note: '' }],
    interestRateAnnual: null,
    minimumPaymentCents: null,
    confirmedBalanceCents: null,
    dueDay: null,
    source: 'workbook',
    notes: '',
  }

  it('separates workbook balance from confirmed balance and ignores a negative remainder', () => {
    expect(debtWorkbookBalance(debt)).toBe(-200)
    expect(outstandingDebt([debt]).cents).toBe(0)
    expect(outstandingDebt([{ ...debt, confirmedBalanceCents: 1150000 }]).cents).toBe(1150000)
    expect(netWorth([100], [null])).toBeNull()
    expect(netWorth([500000], [125000])).toBe(375000)
  })

  it('requires a rate before projecting payoff', () => {
    expect(projectSingleDebt(100000, 6, 5000).ok).toBe(true)
    expect(repaymentScenario([{ ...debt, components: [{ id: 'a', name: 'Loan', amountCents: 1150000 }], payments: [], interestRateAnnual: null, minimumPaymentCents: null }], 'avalanche', 0, '2026-10').ok).toBe(false)
    expect(repaymentScenario([{ ...debt, components: [{ id: 'a', name: 'Loan', amountCents: 100000 }], payments: [], interestRateAnnual: 5, minimumPaymentCents: 5000 }], 'snowball', 1000, '2026-10').ok).toBe(true)
  })
})

describe('duplicate detection', () => {
  it('flags repeated imports and ignores a different amount', () => {
    const existing = [tx({ id: 'old', date: '2026-02-01', kind: 'expense', amountCents: 500, description: 'Rent', categoryId: 'rent' })]
    const incoming = [
      tx({ date: '2026-02-01', kind: 'expense', amountCents: 500, description: 'Rent', categoryId: 'rent' }),
      tx({ date: '2026-02-01', kind: 'expense', amountCents: 700, description: 'Rent', categoryId: 'rent' }),
    ]
    const hits = findDuplicateGroups(existing, incoming)
    expect(hits).toHaveLength(1)
    expect(hits[0].existingIds).toEqual(['old'])
  })
})
