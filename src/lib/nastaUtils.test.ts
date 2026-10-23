import { describe, expect, it } from 'vitest'
import {
  formatEuroField,
  formatEuroLabel,
  isEuroFieldTyping,
  parseEuroField,
  roundEuro,
} from './euroAmount'
import { findDuplicateExpenses, formatDuplicateAlert } from './duplicateExpenses'
import type { Transaction } from './types'

describe('euroAmount helpers (from nasta-dashboard)', () => {
  it('roundEuro rounds to 2 decimals safely', () => {
    expect(roundEuro(12.3456)).toBe(12.35)
    expect(roundEuro(10)).toBe(10)
    expect(roundEuro(-5)).toBe(0)
    expect(roundEuro(NaN)).toBe(0)
  })

  it('parseEuroField parses both commas and dots', () => {
    expect(parseEuroField('12,50')).toBe(12.5)
    expect(parseEuroField('12.50')).toBe(12.5)
    expect(parseEuroField('  3,45 ')).toBe(3.45)
    expect(parseEuroField('')).toBe(0)
    expect(parseEuroField('.')).toBe(0)
    expect(parseEuroField(25.4)).toBe(25.4)
  })

  it('isEuroFieldTyping allows intermediate keystrokes', () => {
    expect(isEuroFieldTyping('')).toBe(true)
    expect(isEuroFieldTyping('3')).toBe(true)
    expect(isEuroFieldTyping('3.')).toBe(true)
    expect(isEuroFieldTyping('3,')).toBe(true)
    expect(isEuroFieldTyping('3.5')).toBe(true)
    expect(isEuroFieldTyping('3.50')).toBe(true)
    expect(isEuroFieldTyping('3.500')).toBe(false)
    expect(isEuroFieldTyping('abc')).toBe(false)
  })

  it('formatEuroField formats numbers without trailing zero bugs', () => {
    expect(formatEuroField(15)).toBe('15')
    expect(formatEuroField(15.5)).toBe('15.5')
    expect(formatEuroField(15.75)).toBe('15.75')
  })

  it('formatEuroLabel formats clean labels', () => {
    expect(formatEuroLabel(12)).toBe('12')
    expect(formatEuroLabel(12.5)).toBe('12.50')
  })
})

describe('findDuplicateExpenses (from nasta-dashboard)', () => {
  it('finds duplicates sharing date, category, and amount', () => {
    const txs: Transaction[] = [
      {
        id: 'tx1',
        date: '2025-01-15',
        dayKnown: true,
        description: 'Rewe groceries',
        categoryId: 'groceries',
        amountCents: 4500,
        kind: 'expense',
        account: 'Revolut',
        notes: '',
        origin: 'actual',
        confidence: 'confirmed',
        source: 'workbook',
        recurring: false,
      },
      {
        id: 'tx2',
        date: '2025-01-15',
        dayKnown: true,
        description: 'Rewe market',
        categoryId: 'groceries',
        amountCents: 4500,
        kind: 'expense',
        account: 'Revolut',
        notes: '',
        origin: 'actual',
        confidence: 'confirmed',
        source: 'workbook',
        recurring: false,
      },
      {
        id: 'tx3',
        date: '2025-01-16',
        dayKnown: true,
        description: 'Edeka groceries',
        categoryId: 'groceries',
        amountCents: 4500,
        kind: 'expense',
        account: 'Revolut',
        notes: '',
        origin: 'actual',
        confidence: 'confirmed',
        source: 'workbook',
        recurring: false,
      },
    ]

    const dupes = findDuplicateExpenses(txs)
    expect(dupes.length).toBe(1)
    expect(dupes[0].count).toBe(2)
    expect(dupes[0].date).toBe('2025-01-15')
    expect(dupes[0].amountCents).toBe(4500)
    expect(dupes[0].descriptions).toContain('Rewe groceries')
    expect(dupes[0].descriptions).toContain('Rewe market')

    const alert = formatDuplicateAlert(dupes[0])
    expect(alert).toContain('Potential duplicate: €45.00 on 2025-01-15')
  })
})
