import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { debtWorkbookBalance } from './calc'
import { estimatePayslip, plannedSip } from './forecast'
import { parseWorkbook } from './parseWorkbook'
import { sheetsFromArrayBuffer } from './xlsxIo'

const file = 'C:\\Users\\Jjeyara\\Downloads\\Expense Tracker.xlsx'

function fileBuffer(path: string): ArrayBuffer {
  const buffer = readFileSync(path)
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
}

describe('expense tracker workbook', () => {
  const result = parseWorkbook(sheetsFromArrayBuffer(fileBuffer(file)), '2026-10-22')

  it('imports history once and keeps the plan separate', () => {
    const expenses = result.transactions.filter((transaction) => transaction.kind === 'expense')
    const income = result.transactions.filter((transaction) => transaction.kind === 'income')
    const transfers = result.transactions.filter((transaction) => transaction.kind === 'transfer')
    expect(expenses.reduce((sum, transaction) => sum + transaction.amountCents, 0)).toBe(3961209)
    expect(income.reduce((sum, transaction) => sum + transaction.amountCents, 0)).toBe(3693100)
    expect(transfers.reduce((sum, transaction) => sum + transaction.amountCents, 0)).toBe(43200)
    expect(result.transactions.some((transaction) => transaction.origin === 'forecast')).toBe(false)
    expect(result.transactions.some((transaction) => transaction.categoryId === 'food' && transaction.date.startsWith('2025-07'))).toBe(false)
    expect(result.transactions.some((transaction) => transaction.categoryId === 'food' && transaction.date.startsWith('2025-06') && transaction.amountCents === 61000)).toBe(true)
    const julyRestaurant = result.transactions.filter((transaction) => transaction.categoryId === 'restaurant' && transaction.date.startsWith('2025-07'))
    expect(julyRestaurant.reduce((sum, transaction) => sum + transaction.amountCents, 0)).toBe(6964)
    expect(result.stats.actualStart).toBe('2023-12-01')
    expect(result.stats.actualEnd).toBe('2026-02-01')
  })

  it('explains workbook differences instead of hiding them', () => {
    const byMonth = new Map(result.reconciliation.map((row) => [row.month, row]))
    expect(byMonth.get('2024-01')?.differenceCents).toBe(0)
    expect(byMonth.get('2024-03')?.differenceCents).toBe(168000)
    expect(byMonth.get('2025-01')?.differenceCents).toBe(0)
    expect(byMonth.get('2026-02')?.differenceCents).toBe(8788)
    expect(result.issues.some((issue) => issue.code === 'missing-total-formula')).toBe(true)
    expect(result.issues.some((issue) => issue.code === 'identity-sheet-skipped')).toBe(true)
    expect(result.issues.some((issue) => issue.code === 'future-marked-complete')).toBe(true)
    const dumped = JSON.stringify(result)
    expect(dumped).not.toMatch(/\b[A-Z]{2}\d{20}\b/)
    expect(result.transactions.some((transaction) => transaction.categoryId === 'electricity')).toBe(false)
  })

  it('keeps debt, salary, and recurring plans editable and unconfirmed', () => {
    const anna = result.debts.find((debt) => debt.name === 'Anna')
    const appa = result.debts.find((debt) => debt.name === 'Appa')
    expect(anna && debtWorkbookBalance(anna)).toBe(-200)
    expect(appa && debtWorkbookBalance(appa)).toBe(1150000)
    expect(appa?.confirmedBalanceCents).toBeNull()
    expect(appa?.interestRateAnnual).toBeNull()
    const rent = result.recurring.find((rule) => rule.categoryId === 'rent')
    const ticket = result.recurring.find((rule) => rule.categoryId === 'deutschlandticket')
    const family = result.recurring.find((rule) => rule.categoryId === 'family-insurance')
    expect(rent).toMatchObject({ amountCents: 42000, startMonth: '2027-01', origin: 'forecast' })
    expect(ticket?.amountCents).toBe(6300)
    expect(family).toMatchObject({ amountCents: 10000, startMonth: '2027-01', endMonth: '2027-03' })
    expect(result.incomePlans[0]).toMatchObject({ grossMonthlyCents: 432082, startMonth: '2027-01', estimated: true })
    const payslip = estimatePayslip(432082, result.assumptions.rates)
    expect(payslip.unroundedNetEuros).toBeCloseTo(2779.583506, 4)
    expect(payslip.netCents).toBe(277958)
    const marchShare = 0
    const sip = plannedSip(payslip.unroundedNetEuros, 100, 100, marchShare, result.assumptions.targetSavingsRate, result.assumptions.sipRoundToEuros)
    expect(sip.sipEuros).toBe(200)
    expect(result.assumptions.ratesAreEstimates).toBe(true)
    expect(result.goals.every((goal) => goal.currentBalanceCents === null && goal.targetCents === null)).toBe(true)
  })
})
