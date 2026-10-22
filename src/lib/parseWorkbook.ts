import { chapterFromSheet } from './chapter'
import { ensureCategory, slug } from './categories'
import { addMonths, deadlineFromLabel, isoFromUnknown, monthKey } from './dates'
import { toCents } from './money'
import type {
  Assumptions,
  Bill,
  Category,
  Debt,
  Goal,
  ImportIssue,
  ImportResult,
  ImportStats,
  IncomePlan,
  MonthCoverage,
  ReconciliationRow,
  RecurringRule,
  SheetData,
  Transaction,
} from './types'

const SKIP_LABELS = new Set([
  'spend',
  'total',
  'balance',
  'balance transfer',
  'balance account total',
  'savings rate (%)',
  'deduction %',
  'total deduction',
  'income netto',
  'total savings',
  'status',
  'working days',
  'working hours',
  'work place',
  'sem',
  'investment',
  'expenses',
  'tax class',
  'income tax',
  'pension contribution',
  'unemployment insurance',
  'health insurance',
  'long-term care insurance',
  'total pension contribution',
  'total tax paid',
  'total unemployment insur.',
  'total health insurance',
  'total long-term care insur.',
])

interface Resolved {
  value: number | null
  formula: string | null
  direct: boolean
}

interface ReconDraft {
  yearlyCents: number
  foodCacheCents: number | null
  detailCents: number
  semCents: number
  semInSpend: boolean
  transferCents: number
}

export function parseWorkbook(sheets: SheetData[], asOf: string): ImportResult {
  const asOfMonth = monthKey(asOf)
  const categories = new Map<string, Category>()
  const transactions: Transaction[] = []
  const recurring: RecurringRule[] = []
  const debts: Debt[] = []
  const incomePlans: IncomePlan[] = []
  const goals: Goal[] = []
  const issues: ImportIssue[] = []
  const coverage = new Map<string, MonthCoverage>()
  const recon = new Map<string, ReconDraft>()
  const assumptions = emptyAssumptions()
  let skippedZeros = 0
  let skippedCrossSheetTotals = 0
  const sheetsRead: string[] = []
  const completedFuture: string[] = []
  const zeroCategories = new Set<string>()

  for (const sheet of sheets) {
    sheetsRead.push(sheet.name)
    if (isIdentitySheet(sheet)) {
      issues.push({
        severity: 'info',
        code: 'identity-sheet-skipped',
        sheet: sheet.name,
        message: 'This sheet was not imported. It contains personal identifiers, and none of those values were stored.',
      })
      continue
    }
    if (isDebtSheet(sheet)) {
      debts.push(...parseDebts(sheet, issues))
      continue
    }
    if (isDetailSheet(sheet)) {
      const skipped = parseDetail(sheet, categories, transactions, issues, coverage, recon)
      skippedCrossSheetTotals += skipped.missingTotals
      continue
    }
    if (isSalarySheet(sheet)) {
      parseSalary(sheet, categories, recurring, incomePlans, goals, assumptions, issues)
      continue
    }
    if (monthColumns(sheet).length >= 3) {
      const result = parseGrid(sheet, asOfMonth, categories, transactions, recurring, issues, coverage, recon, completedFuture, zeroCategories)
      skippedZeros += result.skippedZeros
      skippedCrossSheetTotals += result.skippedCrossSheet
      continue
    }
    issues.push({
      severity: 'info',
      code: 'sheet-unused',
      sheet: sheet.name,
      message: 'This sheet did not match a known financial layout, so nothing was imported from it.',
    })
  }

  if (skippedZeros > 0) {
    issues.push({
      severity: 'info',
      code: 'explicit-zeros-skipped',
      message: `${skippedZeros} explicit zero amounts were left out. They are recorded zeros, not missing values, and they do not change the totals. Empty cells were not turned into zeros.`,
    })
  }
  if (zeroCategories.size) {
    issues.push({
      severity: 'info',
      code: 'zero-categories',
      message: `These categories were added, but every amount in the plan was zero and no expense was created: ${[...zeroCategories].sort().join(', ')}.`,
    })
  }
  if (completedFuture.length) {
    issues.push({
      severity: 'warning',
      code: 'future-marked-complete',
      message: `${completedFuture.slice(0, 6).join(', ')} ${completedFuture.length > 6 ? `and ${completedFuture.length - 6} more months ` : ''}are marked Completed even though they are after ${asOf}. Those amounts stay in the plan and are not treated as actual spending.`,
    })
  }
  if (assumptions.planEnd && assumptions.horizonNotes.length === 0) {
    assumptions.horizonNotes.push(`The salary and savings plan runs through ${assumptions.planEnd}. Amounts after the current month are plans, not history.`)
  }

  const bills = buildBills(transactions, recurring, categories)
  const reconciliation = buildReconciliation(transactions, recon)
  for (const row of reconciliation) {
    if (row.differenceCents !== 0) {
      issues.push({
        severity: 'warning',
        code: 'reconciliation-difference',
        message: `${row.month}: recorded expenses differ from the summed expense categories by ${(row.differenceCents / 100).toFixed(2)} EUR. ${row.notes.join(' ')}`,
      })
    }
  }

  const actualDates = transactions.filter((transaction) => transaction.origin === 'actual').map((transaction) => transaction.date).sort()
  const allDates = transactions.map((transaction) => transaction.date).sort()
  const stats: ImportStats = {
    transactionCount: transactions.length,
    actualCount: transactions.filter((transaction) => transaction.origin === 'actual').length,
    forecastRuleCount: recurring.length,
    incomeCount: transactions.filter((transaction) => transaction.kind === 'income').length,
    expenseCount: transactions.filter((transaction) => transaction.kind === 'expense').length,
    transferCount: transactions.filter((transaction) => transaction.kind === 'transfer').length,
    skippedZeros,
    skippedCrossSheetTotals,
    periodStart: allDates[0] ?? null,
    periodEnd: allDates[allDates.length - 1] ?? assumptions.planEnd,
    actualStart: actualDates[0] ?? null,
    actualEnd: actualDates[actualDates.length - 1] ?? null,
    sheetsRead,
  }

  return {
    transactions,
    categories: [...categories.values()].sort((a, b) => a.name.localeCompare(b.name)),
    debts,
    incomePlans,
    recurring,
    goals,
    bills,
    assumptions,
    coverage: [...coverage.values()].sort((a, b) => a.month.localeCompare(b.month)),
    issues,
    reconciliation,
    stats,
  }
}

export function emptyAssumptions(): Assumptions {
  return {
    rates: { incomeTax: 0, pension: 0, unemployment: 0, health: 0, longTermCare: 0 },
    ratesAreEstimates: true,
    targetSavingsRate: 0,
    sipRoundToEuros: 50,
    shareSegments: [],
    planStart: null,
    planEnd: null,
    manualRunRateIncomeCents: null,
    manualRunRateExpenseCents: null,
    accounts: [],
    horizonNotes: [],
  }
}

function parseGrid(
  sheet: SheetData,
  asOfMonth: string,
  categories: Map<string, Category>,
  transactions: Transaction[],
  recurring: RecurringRule[],
  issues: ImportIssue[],
  coverage: Map<string, MonthCoverage>,
  recon: Map<string, ReconDraft>,
  completedFuture: string[],
  zeroCategories: Set<string>,
): { skippedZeros: number; skippedCrossSheet: number } {
  const columns = monthColumns(sheet)
  const status = statusByColumn(sheet, columns)
  for (const column of columns) {
    const month = column.iso.slice(0, 7)
    if (month > asOfMonth && status.get(column.col) === 'completed') completedFuture.push(month)
  }
  let skippedZeros = 0
  let skippedCrossSheet = 0
  const spendRow = findLabelRow(sheet, 'spend')
  const semRow = findLabelRow(sheet, 'sem fee')
  for (let row = 1; row < sheet.values.length; row += 1) {
    const label = labelAt(sheet, row)
    const key = norm(label)
    if (!label || SKIP_LABELS.has(key) || key === 'completed') continue
    const category = ensureCategory(categories, label)
    const futurePoints: Array<{ month: string; cents: number; cell: string }> = []
    let sawNumber = false
    let nonZero = 0
    for (const column of columns) {
      const cell = addr(row, column.col)
      const formula = normFormula(sheet.formulas[row]?.[column.col])
      const month = column.iso.slice(0, 7)
      if (key === 'food' && formula?.includes('!')) {
        skippedCrossSheet += 1
        const cached = typeof sheet.values[row][column.col] === 'number' ? toCents(sheet.values[row][column.col] as number) : null
        const draft = ensureRecon(recon, month)
        draft.foodCacheCents = cached
        continue
      }
      const resolved = resolveNumber(sheet, row, column.col)
      if (resolved.value === null) continue
      sawNumber = true
      const cents = toCents(resolved.value)
      if (month <= asOfMonth) {
        mark(coverage, month, category.kind === 'income' ? { incomeKnown: true } : { expenseKnown: true })
        if (cents === 0) {
          skippedZeros += 1
          continue
        }
        nonZero += 1
        const confidence = confidenceFor(label, cents, category.kind)
        transactions.push(makeTransaction({
          sheet: sheet.name,
          cell,
          date: column.iso,
          description: label,
          category,
          cents,
          origin: 'actual',
          confidence,
          notes: noteFor(sheet.name, cell, confidence, false),
        }))
        if (category.kind === 'expense') {
          const draft = ensureRecon(recon, month)
          if (key === 'sem fee') draft.semCents += cents
          else draft.yearlyCents += cents
        }
        if (category.kind === 'transfer') ensureRecon(recon, month).transferCents += cents
      } else {
        futurePoints.push({ month, cents, cell })
        if (cents !== 0) nonZero += 1
      }
    }
    if (key === 'sem fee' && spendRow >= 0) {
      for (const column of columns) {
        const month = column.iso.slice(0, 7)
        if (month > asOfMonth) continue
        const formula = normFormula(sheet.formulas[spendRow]?.[column.col]) ?? ''
        if (formula.includes(addr(semRow, column.col))) ensureRecon(recon, month).semInSpend = true
      }
    }
    if (sawNumber && nonZero === 0 && category.kind === 'expense') zeroCategories.add(label)
    for (const segment of toSegments(futurePoints)) {
      const long = monthSpan(segment.start, segment.end) > 24
      recurring.push({
        id: `plan:${slug(sheet.name)}:${category.id}:${segment.start}`,
        name: label,
        categoryId: category.id,
        amountCents: segment.cents,
        kind: category.kind,
        startMonth: segment.start,
        endMonth: segment.end,
        origin: 'forecast',
        confidence: 'estimated',
        source: 'workbook',
        sourceSheet: sheet.name,
        chapter: chapterFromSheet(sheet.name) ?? 'employed',
        note: `Planned amount from ${sheet.name} ${segment.cell}, copied through ${segment.end}. This is not recorded spending.`,
      })
      if (long) {
        issues.push({
          severity: 'info',
          code: 'long-plan',
          sheet: sheet.name,
          cell: segment.cell,
          message: `${label} is filled from ${segment.start} through ${segment.end}. It was stored as one planned recurring amount, not as a confirmed expense for every month.`,
        })
      }
    }
  }
  if (skippedCrossSheet > 0) {
    issues.push({
      severity: 'info',
      code: 'food-detail-used',
      sheet: sheet.name,
      message: `${skippedCrossSheet} Food formulas point at the monthly sheet. Those yearly totals were not imported again. The individual monthly lines are used instead.`,
    })
  }
  return { skippedZeros, skippedCrossSheet }
}

function parseDetail(
  sheet: SheetData,
  categories: Map<string, Category>,
  transactions: Transaction[],
  issues: ImportIssue[],
  coverage: Map<string, MonthCoverage>,
  recon: Map<string, ReconDraft>,
): { missingTotals: number } {
  const totalCol = findTotalColumn(sheet)
  let missingTotals = 0
  const height = sheet.values.length
  let row = 0
  while (row < height) {
    const header = isoFromUnknown(sheet.values[row]?.[0])
    if (!header) {
      row += 1
      continue
    }
    const month = header.slice(0, 7)
    mark(coverage, month, { expenseKnown: true })
    row += 1
    while (row < height && !isoFromUnknown(sheet.values[row]?.[0])) {
      const label = labelAt(sheet, row)
      if (!label) {
        row += 1
        continue
      }
      const category = ensureCategory(categories, label)
      const limit = totalCol ?? Math.min(sheet.values[row].length, 22)
      let count = 0
      for (let col = 1; col < limit; col += 1) {
        const raw = sheet.values[row][col]
        if (typeof raw !== 'number') continue
        const cents = toCents(raw)
        if (cents === 0) continue
        count += 1
        const cell = addr(row, col)
        const confidence = confidenceFor(label, cents, category.kind)
        transactions.push(makeTransaction({
          sheet: sheet.name,
          cell,
          date: header,
          description: label,
          category,
          cents,
          origin: 'actual',
          confidence,
          notes: noteFor(sheet.name, cell, confidence, false),
        }))
        if (category.kind === 'expense') ensureRecon(recon, month).detailCents += cents
      }
      const totalFormula = totalCol !== null ? normFormula(sheet.formulas[row]?.[totalCol]) : null
      if (count > 0 && totalCol !== null && !totalFormula) {
        missingTotals += 1
        issues.push({
          severity: 'warning',
          code: 'missing-total-formula',
          sheet: sheet.name,
          cell: addr(row, 0),
          message: `${label} in ${month} has entered amounts but no total formula. Those amounts are in the ledger. A yearly total that depends on this row will be short.`,
        })
      }
      row += 1
    }
  }
  return { missingTotals }
}

function parseSalary(
  sheet: SheetData,
  categories: Map<string, Category>,
  recurring: RecurringRule[],
  incomePlans: IncomePlan[],
  goals: Goal[],
  assumptions: Assumptions,
  issues: ImportIssue[],
): void {
  const columns = monthColumns(sheet)
  if (columns.length === 0) return
  assumptions.planStart = columns[0].iso.slice(0, 7)
  assumptions.planEnd = columns[columns.length - 1].iso.slice(0, 7)
  const grossRow = findLabelRow(sheet, 'income brutto')
  if (grossRow >= 0) {
    const points: Array<{ month: string; cents: number; cell: string }> = []
    for (const column of columns) {
      const resolved = resolveNumber(sheet, grossRow, column.col)
      if (resolved.value === null) continue
      points.push({ month: column.iso.slice(0, 7), cents: toCents(resolved.value), cell: addr(grossRow, column.col) })
    }
    for (const segment of toSegments(points)) {
      incomePlans.push({
        id: `income:salary:${segment.start}`,
        name: 'Gross salary',
        employer: employerName(sheet) || 'Employer from workbook',
        startMonth: segment.start,
        endMonth: segment.end,
        grossMonthlyCents: segment.cents,
        source: 'workbook',
        chapter: 'employed',
        estimated: true,
        notes: 'The gross amount is carried forward in the workbook. It is a plan, not a recorded payslip.',
      })
    }
  }
  const rateRows: Array<[keyof Assumptions['rates'], string]> = [
    ['incomeTax', 'income tax'],
    ['pension', 'pension contribution'],
    ['unemployment', 'unemployment insurance'],
    ['health', 'health insurance'],
    ['longTermCare', 'long-term care insurance'],
  ]
  for (const [key, label] of rateRows) {
    const row = findLabelRow(sheet, label)
    if (row < 0 || columns.length === 0) continue
    const first = percentRate(normFormula(sheet.formulas[row]?.[columns[0].col]))
    if (first === null) continue
    assumptions.rates[key] = first
    const drifted = columns.some((column) => {
      const rate = percentRate(normFormula(sheet.formulas[row]?.[column.col]))
      return rate !== null && Math.abs(rate - first) > 1e-8
    })
    if (drifted) {
      issues.push({
        severity: 'warning',
        code: 'rate-changed',
        sheet: sheet.name,
        message: `${label} does not use the same percentage in every month. The app uses the first month's rate as the editable estimate.`,
      })
    }
  }
  issues.push({
    severity: 'warning',
    code: 'estimated-deductions',
    sheet: sheet.name,
    message: 'Income tax, pension, unemployment, health, and long-term care amounts are percentage formulas. They are estimates you can edit, not verified payslip figures.',
  })

  const shareRow = findLabelRow(sheet, 'trimble internal share')
  if (shareRow >= 0) {
    let current: Assumptions['shareSegments'][number] | null = null
    for (const column of columns) {
      const rate = percentRate(normFormula(sheet.formulas[shareRow]?.[column.col]))
      const month = column.iso.slice(0, 7)
      if (rate === null) {
        current = null
        continue
      }
      if (current && current.rate === rate && addMonths(current.endMonth, 1) === month) current.endMonth = month
      else {
        current = { startMonth: month, endMonth: month, rate }
        assumptions.shareSegments.push(current)
      }
    }
  }

  const sipRow = findLabelRow(sheet, 'sip')
  const sipFormula = sipRow >= 0 ? normFormula(sheet.formulas[sipRow]?.[columns[0].col]) : null
  const target = sipFormula?.match(/(\d+(?:\.\d+)?)%/)
  const step = sipFormula?.match(/\)\/(\d+),0\)/)
  if (target) assumptions.targetSavingsRate = Number(target[1]) / 100
  if (step) assumptions.sipRoundToEuros = Number(step[1])

  for (const label of ['Gold Investment', 'Emergency Fund']) {
    const row = sheet.values.findIndex((cells, index) => norm(labelAt(sheet, index)) === norm(label) && columns.some((column) => typeof cells[column.col] === 'number'))
    if (row < 0) continue
    const category = ensureCategory(categories, label, { kind: 'savings_contribution', group: 'Savings and investments', fixed: true })
    const points = columns.map((column) => {
      const resolved = resolveNumber(sheet, row, column.col)
      return { month: column.iso.slice(0, 7), cents: resolved.value === null ? 0 : toCents(resolved.value), cell: addr(row, column.col) }
    })
    for (const segment of toSegments(points)) {
      recurring.push({
        id: `plan:${slug(sheet.name)}:${category.id}:${segment.start}`,
        name: label,
        categoryId: category.id,
        amountCents: segment.cents,
        kind: 'savings_contribution',
        startMonth: segment.start,
        endMonth: segment.end,
        origin: 'forecast',
        confidence: 'estimated',
        source: 'workbook',
        sourceSheet: sheet.name,
        chapter: 'employed',
        note: 'Planned savings transfer. It is not an expense and the account balance is unknown.',
      })
      if (monthSpan(segment.start, segment.end) > 24) {
        issues.push({
          severity: 'info',
          code: 'long-plan',
          sheet: sheet.name,
          message: `${label} is filled from ${segment.start} through ${segment.end}. It is a planned transfer, not a confirmed balance.`,
        })
      }
    }
  }

  for (let row = 0; row < sheet.values.length; row += 1) {
    const label = labelAt(sheet, row)
    if (!label) continue
    for (let col = 1; col < (sheet.values[row]?.length ?? 0); col += 1) {
      const value = sheet.values[row][col]
      if (typeof value !== 'string') continue
      if (/^till\s+/i.test(value)) {
        const deadline = deadlineFromLabel(value)
        const id = `goal:${slug(label)}`
        if (!goals.some((goal) => goal.id === id)) {
          const goalName = norm(label).replace(/\still$/, '').trim()
          const rule = recurring.find((item) => {
            const ruleName = norm(item.name)
            return ruleName === goalName || ruleName.startsWith(goalName) || goalName.startsWith(ruleName)
          })
          goals.push({
            id,
            name: label.replace(/\s+till\s*$/i, ''),
            targetCents: null,
            deadline,
            currentBalanceCents: null,
            monthlyContributionCents: rule?.amountCents ?? null,
            contributionEstimated: Boolean(rule),
            source: 'workbook',
            chapter: 'employed',
            notes: `The workbook labels this "${value}". No target amount or account balance was entered, so the balance is unknown.`,
          })
        }
        if (deadline && assumptions.planEnd && assumptions.planEnd > deadline.slice(0, 7)) {
          issues.push({
            severity: 'warning',
            code: 'plan-label-mismatch',
            sheet: sheet.name,
            cell: addr(row, col),
            message: `${label} is labelled "${value}", but the monthly plan continues through ${assumptions.planEnd}. The app follows the monthly cells and keeps this contradiction visible.`,
          })
        }
      }
      if (['spent', 'sip', 'emergency fund', 'balance transfer'].includes(norm(label)) && /[a-z]/i.test(value)) {
        assumptions.accounts.push({ role: label, name: value.trim() })
      }
    }
  }
  assumptions.accounts = uniqueAccounts(assumptions.accounts)
  assumptions.horizonNotes.push('Savings balances are unknown. Planned contributions are not the same as money already saved.')
  assumptions.horizonNotes.push('Investment growth rates in the workbook were not imported as balances.')
  if (assumptions.accounts.some((account) => /captial/i.test(account.name))) {
    issues.push({
      severity: 'info',
      code: 'account-spelling',
      sheet: sheet.name,
      message: 'One account name is stored exactly as written in the workbook. Check the spelling on the Income page before relying on it.',
    })
  }
}

function parseDebts(sheet: SheetData, issues: ImportIssue[]): Debt[] {
  const debts: Debt[] = []
  for (let row = 0; row < sheet.values.length; row += 1) {
    for (let col = 0; col < (sheet.values[row]?.length ?? 0); col += 1) {
      const label = typeof sheet.values[row][col] === 'string' ? String(sheet.values[row][col]).trim() : ''
      if (!/balance/i.test(label)) continue
      const valueCol = col + 1
      const name = label.replace(/balance/i, '').trim() || 'Debt'
      const totalRow = findUp(sheet, row, col, 'total')
      const components = []
      const payments = []
      for (let cursor = 0; cursor < row; cursor += 1) {
        const itemName = typeof sheet.values[cursor]?.[col] === 'string' ? String(sheet.values[cursor][col]).trim() : ''
        const amount = sheet.values[cursor]?.[valueCol]
        if (typeof amount !== 'number') continue
        if (norm(itemName) === 'total') continue
        const cents = toCents(amount)
        if (totalRow >= 0 && cursor < totalRow) {
          if (!itemName) continue
          components.push({ id: `debt:${slug(name)}:${slug(itemName)}:${cursor}`, name: itemName, amountCents: cents, sourceCell: addr(cursor, valueCol) })
        } else if (totalRow >= 0 && cursor > totalRow) {
          payments.push({
            id: `debtpay:${slug(name)}:${cursor}`,
            amountCents: cents,
            principalCents: cents,
            interestCents: 0,
            date: null,
            sourceCell: addr(cursor, valueCol),
            note: 'The workbook does not give this payment a date or an interest split. The full amount is subtracted, matching the sheet.',
          })
        }
      }
      if (components.length === 0) continue
      const opening = components.reduce((sum, component) => sum + component.amountCents, 0)
      const paid = payments.reduce((sum, payment) => sum + payment.principalCents, 0)
      const balance = opening - paid
      if (balance < 0) {
        issues.push({
          severity: 'warning',
          code: 'debt-overpaid',
          sheet: sheet.name,
          cell: addr(row, valueCol),
          message: `${name} calculates to ${(balance / 100).toFixed(2)} EUR after listed payments. The negative amount is shown as a discrepancy and is not added to outstanding debt.`,
        })
      } else {
        issues.push({
          severity: 'warning',
          code: 'debt-unconfirmed',
          sheet: sheet.name,
          cell: addr(row, valueCol),
          message: `${name} still shows ${(balance / 100).toFixed(2)} EUR from the workbook formula. That is not a confirmed statement balance. No interest rate or due date was in the sheet.`,
        })
      }
      debts.push({
        id: `debt:${slug(name)}`,
        name,
        components,
        payments,
        interestRateAnnual: null,
        minimumPaymentCents: null,
        confirmedBalanceCents: null,
        dueDay: null,
        source: 'workbook',
        chapter: 'student',
        notes: `Calculated from ${sheet.name}. Original items and listed payments are kept separate from a confirmed balance.`,
      })
    }
  }
  return debts
}

function buildBills(transactions: Transaction[], recurring: RecurringRule[], categories: Map<string, Category>): Bill[] {
  const bills: Bill[] = []
  const byCategory = new Map<string, Map<string, number>>()
  for (const transaction of transactions) {
    if (transaction.origin !== 'actual' || transaction.kind !== 'expense') continue
    const months = byCategory.get(transaction.categoryId) ?? new Map<string, number>()
    const month = transaction.date.slice(0, 7)
    months.set(month, (months.get(month) ?? 0) + transaction.amountCents)
    byCategory.set(transaction.categoryId, months)
  }
  const span = new Set(transactions.filter((transaction) => transaction.origin === 'actual').map((transaction) => transaction.date.slice(0, 7)))
  for (const [categoryId, months] of byCategory) {
    if (months.size < 6 || span.size === 0 || months.size / span.size < 0.8) continue
    const latest = [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).at(-1)!
    const category = categories.get(categoryId)
    bills.push({
      id: `bill:detected:${categoryId}`,
      name: category?.name ?? categoryId,
      categoryId,
      amountCents: latest[1],
      dueDay: null,
      interval: 'monthly',
      active: false,
      source: 'detected',
      chapter: 'student',
      lastSeenMonth: latest[0],
      note: `Detected from recorded months. Last seen ${latest[0]} for ${(latest[1] / 100).toFixed(2)} EUR. It is not scheduled forward, and the due day was not in the workbook.`,
    })
  }
  for (const rule of recurring) {
    if (rule.kind !== 'expense') continue
    bills.push({
      id: `bill:plan:${rule.id}`,
      name: rule.name,
      categoryId: rule.categoryId,
      amountCents: rule.amountCents,
      dueDay: null,
      interval: 'monthly',
      active: true,
      source: 'workbook',
      chapter: 'employed',
      lastSeenMonth: null,
      note: rule.note,
    })
  }
  return bills
}

function buildReconciliation(transactions: Transaction[], recon: Map<string, ReconDraft>): ReconciliationRow[] {
  return [...recon.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, draft]) => {
    const ledgerExpenseCents = transactions
      .filter((transaction) => transaction.origin === 'actual' && transaction.kind === 'expense' && transaction.date.slice(0, 7) === month)
      .reduce((sum, transaction) => sum + transaction.amountCents, 0)
    const workbookSpendCents = draft.yearlyCents + (draft.foodCacheCents ?? 0) + (draft.semInSpend ? draft.semCents : 0)
    const notes: string[] = []
    if (draft.foodCacheCents !== null && draft.detailCents !== draft.foodCacheCents) {
      notes.push(`Monthly lines total ${((draft.detailCents) / 100).toFixed(2)} EUR and the yearly Food formula total is ${(draft.foodCacheCents / 100).toFixed(2)} EUR.`)
    }
    if (draft.semCents && !draft.semInSpend) {
      notes.push('The semester fee is in the ledger and outside the workbook Spend formula.')
    }
    if (draft.transferCents) {
      notes.push(`Transfers of ${(draft.transferCents / 100).toFixed(2)} EUR sit in the workbook block and are excluded from expenses, so the Spend cell is higher.`)
    }
    if (notes.length === 0 && ledgerExpenseCents !== workbookSpendCents) notes.push('The two totals use different source cells.')
    return { month, ledgerExpenseCents, workbookSpendCents, differenceCents: ledgerExpenseCents - workbookSpendCents, notes }
  })
}

function makeTransaction(input: {
  sheet: string
  cell: string
  date: string
  description: string
  category: Category
  cents: number
  origin: Transaction['origin']
  confidence: Transaction['confidence']
  notes: string
}): Transaction {
  return {
    id: `wb:${input.sheet}:${input.cell}`,
    date: input.date,
    dayKnown: false,
    description: input.description,
    categoryId: input.category.id,
    amountCents: input.cents,
    kind: input.category.kind,
    account: '',
    notes: input.notes,
    origin: input.origin,
    confidence: input.confidence,
    source: 'workbook',
    sourceSheet: input.sheet,
    sourceCell: input.cell,
    chapter: chapterFromSheet(input.sheet) ?? 'student',
    recurring: false,
  }
}

function noteFor(sheet: string, cell: string, confidence: Transaction['confidence'], dayKnown: boolean): string {
  const parts = [`Source: ${sheet} ${cell}.`, dayKnown ? '' : 'Day of month was not recorded.']
  if (confidence === 'needs_review') parts.push('Flagged for review because the amount is unusual or the category may be a transfer.')
  return parts.filter(Boolean).join(' ')
}

function confidenceFor(label: string, cents: number, kind: Transaction['kind']): Transaction['confidence'] {
  const key = norm(label)
  if (key === 'cash' || key.includes('withdraw')) return 'needs_review'
  if (kind === 'expense' && cents >= 100000) return 'needs_review'
  if (kind === 'expense' && cents >= 20000 && (key === 'others' || key.includes('phone') || key.includes('amazon'))) return 'needs_review'
  return 'confirmed'
}

function resolveNumber(sheet: SheetData, row: number, col: number, depth = 0): Resolved {
  const formula = normFormula(sheet.formulas[row]?.[col])
  const raw = sheet.values[row]?.[col]
  if (typeof raw === 'number') return { value: raw, formula, direct: !formula || literalFormula(formula) !== null }
  if (!formula || depth > 12) return { value: null, formula, direct: false }
  const literal = literalFormula(formula)
  if (literal !== null) return { value: literal, formula, direct: true }
  const ref = refFormula(formula)
  if (!ref) return { value: null, formula, direct: false }
  const next = resolveNumber(sheet, ref.row, ref.col, depth + 1)
  return { value: next.value, formula, direct: false }
}

function monthColumns(sheet: SheetData): Array<{ col: number; iso: string }> {
  const columns: Array<{ col: number; iso: string }> = []
  const width = sheet.values[0]?.length ?? 0
  for (let col = 1; col < width; col += 1) {
    const direct = isoFromUnknown(sheet.values[0][col])
    if (direct) {
      columns.push({ col, iso: direct })
      continue
    }
    const formula = normFormula(sheet.formulas[0]?.[col])
    if (formula?.startsWith('EDATE(') && columns.length) {
      columns.push({ col, iso: `${addMonths(columns[columns.length - 1].iso.slice(0, 7), 1)}-01` })
    }
  }
  return columns
}

function columnADates(sheet: SheetData): number {
  return sheet.values.filter((row) => isoFromUnknown(row?.[0])).length
}

function isIdentitySheet(sheet: SheetData): boolean {
  const text = sheet.values.flat().filter((value) => typeof value === 'string').join('\n').toLowerCase()
  return ['iban', 'steuer', 'social security', 'tax id', 'bic'].filter((token) => text.includes(token)).length >= 2
}

function isDebtSheet(sheet: SheetData): boolean {
  const text = sheet.values.flat().filter((value) => typeof value === 'string').join('\n').toLowerCase()
  return text.includes('balance') && text.includes('paid') && monthColumns(sheet).length < 3 && columnADates(sheet) < 2
}

function isDetailSheet(sheet: SheetData): boolean {
  return columnADates(sheet) >= 2 && monthColumns(sheet).length < 3
}

function isSalarySheet(sheet: SheetData): boolean {
  return sheet.values.some((_, row) => norm(labelAt(sheet, row)) === 'income brutto')
}

function statusByColumn(sheet: SheetData, columns: Array<{ col: number }>): Map<number, string> {
  const map = new Map<number, string>()
  for (let row = 0; row < sheet.values.length; row += 1) {
    const texts = columns.map((column) => sheet.values[row]?.[column.col]).filter((value) => typeof value === 'string') as string[]
    const completed = texts.filter((value) => norm(value) === 'completed').length
    if (texts.length < 2 || completed / texts.length < 0.5) continue
    for (const column of columns) {
      const value = sheet.values[row]?.[column.col]
      if (typeof value === 'string') map.set(column.col, norm(value))
    }
  }
  return map
}

function findTotalColumn(sheet: SheetData): number | null {
  const width = Math.max(...sheet.formulas.map((row) => row.length), 0)
  let best: { col: number; count: number } | null = null
  for (let col = 2; col < width; col += 1) {
    const count = sheet.formulas.filter((row) => normFormula(row[col])?.startsWith('SUM(')).length
    if (!best || count > best.count) best = { col, count }
  }
  return best && best.count >= 3 ? best.col : null
}

function findLabelRow(sheet: SheetData, label: string): number {
  return sheet.values.findIndex((_, row) => norm(labelAt(sheet, row)) === label)
}

function findUp(sheet: SheetData, from: number, col: number, label: string): number {
  for (let row = from; row >= 0; row -= 1) {
    if (norm(String(sheet.values[row]?.[col] ?? '')) === label) return row
  }
  return -1
}

function labelAt(sheet: SheetData, row: number): string {
  const value = sheet.values[row]?.[0]
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

function norm(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function normFormula(formula: string | null | undefined): string | null {
  if (!formula) return null
  return formula.replace(/^=/, '').replace(/\s+/g, '').toUpperCase()
}

function literalFormula(formula: string): number | null {
  return /^-?\d+(\.\d+)?$/.test(formula) ? Number(formula) : null
}

function refFormula(formula: string): { row: number; col: number } | null {
  const match = formula.match(/^([A-Z]+)(\d+)$/)
  if (!match) return null
  return { row: Number(match[2]) - 1, col: columnIndex(match[1]) }
}

function percentRate(formula: string | null): number | null {
  if (!formula) return null
  const match = formula.match(/^[A-Z]+\d+\*(0\.\d+|\d+(?:\.\d+)?)(%?)$/)
  if (!match) return null
  const number = Number(match[1])
  return match[2] ? number / 100 : number
}

function columnIndex(name: string): number {
  let index = 0
  for (const char of name) index = index * 26 + (char.charCodeAt(0) - 64)
  return index - 1
}

function colName(index: number): string {
  let n = index + 1
  let name = ''
  while (n > 0) {
    const mod = (n - 1) % 26
    name = String.fromCharCode(65 + mod) + name
    n = Math.floor((n - 1) / 26)
  }
  return name
}

function addr(row: number, col: number): string {
  return `${colName(col)}${row + 1}`
}

function toSegments(points: Array<{ month: string; cents: number; cell: string }>): Array<{ start: string; end: string; cents: number; cell: string }> {
  const segments: Array<{ start: string; end: string; cents: number; cell: string }> = []
  let current: { start: string; end: string; cents: number; cell: string } | null = null
  for (const point of points) {
    if (!point.cents) {
      current = null
      continue
    }
    if (current && current.cents === point.cents && addMonths(current.end, 1) === point.month) current.end = point.month
    else {
      current = { start: point.month, end: point.month, cents: point.cents, cell: point.cell }
      segments.push(current)
    }
  }
  return segments
}

function monthSpan(start: string, end: string): number {
  const [startYear, startMonth] = start.split('-').map(Number)
  const [endYear, endMonth] = end.split('-').map(Number)
  return (endYear - startYear) * 12 + (endMonth - startMonth) + 1
}

function mark(coverage: Map<string, MonthCoverage>, month: string, patch: { incomeKnown?: boolean; expenseKnown?: boolean }): void {
  const current = coverage.get(month) ?? { month, incomeKnown: false, expenseKnown: false }
  current.incomeKnown = current.incomeKnown || Boolean(patch.incomeKnown)
  current.expenseKnown = current.expenseKnown || Boolean(patch.expenseKnown)
  coverage.set(month, current)
}

function ensureRecon(recon: Map<string, ReconDraft>, month: string): ReconDraft {
  const current = recon.get(month) ?? { yearlyCents: 0, foodCacheCents: null, detailCents: 0, semCents: 0, semInSpend: false, transferCents: 0 }
  recon.set(month, current)
  return current
}

function employerName(sheet: SheetData): string {
  const row = findLabelRow(sheet, 'work place')
  if (row < 0) return ''
  const value = sheet.values[row].find((cell) => typeof cell === 'string' && cell.trim())
  return typeof value === 'string' ? value.trim() : ''
}

function uniqueAccounts(accounts: Assumptions['accounts']): Assumptions['accounts'] {
  const seen = new Set<string>()
  return accounts.filter((account) => {
    const key = `${norm(account.role)}|${norm(account.name)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
