import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, Empty, Notice, Panel } from '../components/ui'
import { scopeState } from '../lib/chapter'
import { findDuplicateGroups } from '../lib/duplicates'
import { isValidIsoDate, monthLabel } from '../lib/dates'
import { stableCharges, unusualIncreases } from '../lib/insights'
import { formatMoney, formatPercent, parseAmount } from '../lib/money'
import { categoryById, categoryName, categoryTotals, colorFor, periodLabel, trend, visibleTransactions } from '../lib/selectors'
import { isAppState } from '../lib/createState'
import type { Category, ImportResult, Transaction, TxKind } from '../lib/types'
import { newTransaction, useStore } from '../state/store'
import { parseCsv, transactionsToCsv, workbookFromTransactions } from '../lib/xlsxIo'
import { eligibleSpend } from '../lib/calc'
import { categoryFromName } from '../lib/categories'

export function ReportsPage() {
  const { state: full, setFilters } = useStore()
  const state = scopeState(full)
  const rows = visibleTransactions(state).filter((transaction) => transaction.origin === 'actual')
  const history = trend(state, state.filters.month, state.filters.month === 'all' ? 24 : 12)
  const totals = categoryTotals(rows)
  const slices = totals.slice(0, 8).map((item) => ({ id: item.id, name: categoryName(state, item.id), value: item.cents / 100 }))
  const fixed = rows.filter((transaction) => transaction.kind === 'expense' && categoryById(state, transaction.categoryId)?.fixed).reduce((sum, transaction) => sum + transaction.amountCents, 0)
  const variable = rows.filter((transaction) => transaction.kind === 'expense' && !categoryById(state, transaction.categoryId)?.fixed).reduce((sum, transaction) => sum + transaction.amountCents, 0)
  const observations = unusualIncreases(rows).slice(0, 8)
  const recurring = stableCharges(rows).slice(0, 6)
  const yoy = yearComparison(state.transactions, state.filters.month)
  const budgetRows = state.budgets.filter((budget) => budget.period === 'month' && state.filters.month !== 'all').map((budget) => ({
    name: categoryName(state, budget.categoryId),
    budget: budget.amountCents / 100,
    spent: eligibleSpend(state.transactions, budget.categoryId, { month: state.filters.month }) / 100,
  }))

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <h1>Reports</h1>
          <p>{periodLabel(state)}. Charts follow the filters in the top bar. Select a slice to open the records behind it.</p>
        </div>
      </header>
      <div className="grid-2">
        <Panel title="Income versus expenses">
          <div className="chart"><ResponsiveContainer><BarChart data={history}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 11 }} /><YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} /><Tooltip formatter={(value) => formatMoney(Math.round(Number(value) * 100))} /><Bar dataKey="income" name="Income" fill="#0f7b4c" /><Bar dataKey="expense" name="Expenses" fill="#5c6b7a" /></BarChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Savings rate">
          <div className="chart"><ResponsiveContainer><LineChart data={history}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 11 }} /><YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} /><Tooltip formatter={(value) => formatPercent(Number(value))} /><Line dataKey="rate" name="Savings rate" stroke="#0f7b4c" dot={false} connectNulls={false} /></LineChart></ResponsiveContainer></div>
        </Panel>
      </div>
      <div className="grid-2">
        <Panel title="Expenses by category">
          {slices.length === 0 ? <Empty title="No expenses in this filter" body="Try another month or clear the category filter." /> : (
            <div className="chart"><ResponsiveContainer><PieChart><Pie data={slices} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} onClick={(item) => { if (item && 'id' in item && item.id) { setFilters({ categoryId: String(item.id), kind: 'expense' }); location.hash = 'expenses' } }}>{slices.map((slice) => <Cell key={slice.id} fill={colorFor(slice.id)} />)}</Pie><Tooltip formatter={(value) => formatMoney(Math.round(Number(value) * 100))} /></PieChart></ResponsiveContainer></div>
          )}
        </Panel>
        <Panel title="Fixed versus variable">
          <div className="row-card"><span>Fixed</span><strong>{formatMoney(fixed)}</strong></div>
          <div className="row-card"><span>Variable</span><strong>{formatMoney(variable)}</strong></div>
          <p className="muted">Fixed is a category setting. You can change it on the Expenses page. It is not a judgement of whether the month went well.</p>
        </Panel>
      </div>
      <Panel title="Actual versus budget">
        {budgetRows.length === 0 ? <Empty title="No monthly budgets in this view" body="Add budgets, then choose a single month." /> : <div className="chart"><ResponsiveContainer><BarChart data={budgetRows}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} interval={0} angle={-20} height={60} /><YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} /><Tooltip formatter={(value) => formatMoney(Math.round(Number(value) * 100))} /><Bar dataKey="budget" name="Budget" fill="#94a3b8" /><Bar dataKey="spent" name="Spent" fill="#0f7b4c" /></BarChart></ResponsiveContainer></div>}
      </Panel>
      <div className="grid-2">
        <Panel title="Same month last year">
          {yoy ? <><div className="row-card"><span>Income</span><span>{formatMoney(yoy.current.incomeCents)} vs {formatMoney(yoy.previous.incomeCents)}</span></div><div className="row-card"><span>Expenses</span><span>{formatMoney(yoy.current.expenseCents)} vs {formatMoney(yoy.previous.expenseCents)}</span></div></> : <p>There is no earlier year for this month, so a year-over-year comparison is not available.</p>}
        </Panel>
        <Panel title="Net worth and debt history">
          <p>Net worth is unknown. The workbook has no confirmed asset balances, and the debt figures are formula balances rather than statements.</p>
          <p className="muted">Outstanding workbook debt is shown on the dashboard. It is not drawn as a history chart because the sheet does not record a balance for each month.</p>
        </Panel>
      </div>
      <Panel title="Changes backed by the records">
        {observations.length === 0 ? <p className="muted">No category rose by at least 50% and €50 against the previous recorded month in this filter.</p> : observations.map((item) => (
          <button type="button" className="row-card" key={`${item.month}-${item.categoryId}`} onClick={() => { setFilters({ month: item.month, categoryId: item.categoryId, kind: 'expense' }); location.hash = 'expenses' }}>
            <span>{categoryName(state, item.categoryId)} · {monthLabel(item.month)}</span>
            <span>{formatMoney(item.previousCents)} → {formatMoney(item.currentCents)}</span>
          </button>
        ))}
        {recurring.length ? <h2 style={{ marginTop: 12 }}>Stable recorded charges</h2> : null}
        {recurring.map((item) => <div className="row-card" key={item.categoryId}><span>{categoryName(state, item.categoryId)}</span><span>Typical {formatMoney(item.typicalCents)} across {item.months} recent months</span></div>)}
      </Panel>
    </div>
  )
}

function yearComparison(transactions: Transaction[], month: string) {
  if (month === 'all') return null
  const [year, mon] = month.split('-')
  const prior = `${Number(year) - 1}-${mon}`
  const currentRows = transactions.filter((transaction) => transaction.origin === 'actual' && transaction.date.startsWith(month))
  const priorRows = transactions.filter((transaction) => transaction.origin === 'actual' && transaction.date.startsWith(prior))
  if (currentRows.length === 0 || priorRows.length === 0) return null
  const sum = (rows: Transaction[], kind: TxKind) => rows.filter((row) => row.kind === kind).reduce((total, row) => total + row.amountCents, 0)
  return { current: { incomeCents: sum(currentRows, 'income'), expenseCents: sum(currentRows, 'expense') }, previous: { incomeCents: sum(priorRows, 'income'), expenseCents: sum(priorRows, 'expense') } }
}

export function DataPage() {
  const { state, applyWorkbook, commitImport, replaceState } = useStore()
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [message, setMessage] = useState('')
  const [csvRows, setCsvRows] = useState<Transaction[]>([])
  const [csvCategories, setCsvCategories] = useState<Category[]>([])
  const [csvErrors, setCsvErrors] = useState<string[]>([])
  const [acceptDupes, setAcceptDupes] = useState(false)
  const duplicates = useMemo(() => findDuplicateGroups(state.transactions, csvRows), [state.transactions, csvRows])
  const diffs = state.reconciliation.filter((row) => row.differenceCents !== 0)

  async function onWorkbook(file: File) {
    const buffer = await file.arrayBuffer()
    const result = applyWorkbook(buffer, new Date().toISOString().slice(0, 10))
    setPreview(result)
    setMessage(`${file.name} is ready to apply. The original file was not modified.`)
  }

  function download(filename: string, blob: Blob) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <h1>Data</h1>
          <p>This browser keeps the records locally. Uploading a new workbook replaces workbook rows and keeps records you added.</p>
        </div>
      </header>
      <Panel title="Update from Excel">
        <label className="drop">
          <strong>Drop the updated Expense Tracker file here</strong>
          <p className="muted">.xlsx — personal identifier sheets are skipped and never stored.</p>
          <input type="file" accept=".xlsx,.xls" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void onWorkbook(file) }} />
        </label>
        {message ? <p>{message}</p> : null}
        {preview ? (
          <div className="stack">
            <div className="stat-grid">
              <Mini label="Records" value={String(preview.stats.transactionCount)} />
              <Mini label="Actual period" value={`${preview.stats.actualStart ?? '—'} → ${preview.stats.actualEnd ?? '—'}`} />
              <Mini label="Plan rules" value={String(preview.stats.forecastRuleCount)} />
              <Mini label="Issues" value={String(preview.issues.length)} />
            </div>
            <p className="muted">Manual records stay. Workbook rows you edited stay. Deleted workbook rows stay deleted. {state.settings.assumptionsLocked ? 'Deduction rates stay locked.' : 'Deduction rates will refresh from the file.'}</p>
            <button type="button" className="btn primary" onClick={() => { commitImport(preview); setPreview(null); setMessage('Dashboard updated from the workbook.') }}>Apply import</button>
          </div>
        ) : null}
      </Panel>
      <Panel title="Import summary" extra={state.lastImportAt ? <Badge>Updated {state.lastImportAt.slice(0, 10)}</Badge> : null}>
        {state.stats ? <p>{state.stats.transactionCount} records, {state.stats.expenseCount} expenses, {state.stats.incomeCount} income lines, {state.stats.transferCount} transfers. Actual period {state.stats.actualStart} to {state.stats.actualEnd}. {state.stats.skippedZeros} explicit zeros were skipped. {diffs.length} months differ from the workbook Spend row; {state.reconciliation.length - diffs.length} match.</p> : <Empty title="No workbook loaded" body="Upload Expense Tracker.xlsx to fill the dashboard." />}
        <div className="issue-list">
          {state.issues.map((issue, index) => <div className="issue" key={`${issue.code}-${index}`}><Badge tone={issue.severity === 'warning' ? 'warn' : 'muted'}>{issue.severity}</Badge> {issue.message}</div>)}
        </div>
      </Panel>
      <Panel title="CSV import">
        <input type="file" accept=".csv,text/csv" onChange={async (event) => {
          const file = event.target.files?.[0]
          if (!file) return
          const parsed = parseCsv(await file.text())
          const errors = [...parsed.errors]
          const transactions: Transaction[] = []
          const categories: Category[] = []
          parsed.rows.forEach((row, index) => {
            const amount = parseAmount(row.amount)
            if (!isValidIsoDate(row.date) || amount === null || amount === 0 || !row.category) {
              errors.push(`Row ${index + 2} has an invalid date or amount.`)
              return
            }
            const category = categoryFromName(row.category)
            if (!categories.some((item) => item.id === category.id)) categories.push(category)
            const kind = (['income', 'expense', 'transfer', 'debt_payment', 'savings_contribution'].includes(row.type) ? row.type : 'expense') as TxKind
            transactions.push(newTransaction({ date: row.date, amountCents: amount, categoryId: category.id, kind, description: row.description || row.category, account: row.account, notes: row.notes, source: 'csv' }))
          })
          setCsvErrors(errors)
          setCsvCategories(categories)
          setCsvRows(transactions)
          setAcceptDupes(false)
        }} />
        {csvErrors.length ? <Notice tone="warn">{csvErrors.slice(0, 5).join(' ')}</Notice> : null}
        {duplicates.length ? <label className="check"><input type="checkbox" checked={acceptDupes} onChange={(event) => setAcceptDupes(event.target.checked)} /> Import {duplicates.length} possible duplicate groups anyway</label> : null}
        {csvRows.length ? <button type="button" className="btn primary" disabled={duplicates.length > 0 && !acceptDupes} onClick={() => {
          const existingIds = new Set(state.categories.map((category) => category.id))
          replaceState({
            ...state,
            categories: [...state.categories, ...csvCategories.filter((category) => !existingIds.has(category.id))],
            transactions: [...csvRows, ...state.transactions],
          })
          setCsvRows([])
          setCsvCategories([])
          setMessage('CSV rows were added.')
        }}>Add {csvRows.length} CSV rows</button> : null}
      </Panel>
      <Panel title="Export and backup">
        <div className="actions">
          <button type="button" className="btn" onClick={() => download('transactions.csv', new Blob([transactionsToCsv(state.transactions, (id) => categoryName(state, id))], { type: 'text/csv' }))}>Export CSV</button>
          <button type="button" className="btn" onClick={() => download('transactions.xlsx', new Blob([workbookFromTransactions(state.transactions, (id) => categoryName(state, id))]))}>Export Excel</button>
          <button type="button" className="btn" onClick={() => download('finance-backup.json', new Blob([JSON.stringify(state)], { type: 'application/json' }))}>Download backup</button>
          <label className="btn">Restore backup<input type="file" accept="application/json" hidden onChange={async (event) => {
            const file = event.target.files?.[0]
            if (!file) return
            const parsed = JSON.parse(await file.text()) as unknown
            if (!isAppState(parsed)) { setMessage('That file is not a dashboard backup.'); return }
            replaceState(parsed)
            setMessage('Backup restored in this browser.')
          }} /></label>
        </div>
        <p className="muted">Data stays in this browser's IndexedDB. It is not sent to a bank or another service. The backup file is not encrypted.</p>
      </Panel>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return <article className="stat"><p>{label}</p><strong style={{ fontSize: '1rem' }}>{value}</strong></article>
}
