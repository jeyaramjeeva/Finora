import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge, Empty, Notice, Panel } from '../components/ui'
import { ChartChrome, chartTooltipStyle } from '../components/ChartChrome'
import { CategoryBadge } from '../components/CategoryBadge'
import { scopeState } from '../lib/chapter'
import { findDuplicateGroups } from '../lib/duplicates'
import { monthLabel } from '../lib/dates'
import { stableCharges, unusualIncreases } from '../lib/insights'
import { formatMoney, formatPercent, parseAmount } from '../lib/money'
import { categoryById, categoryName, categoryTotals, colorFor, periodLabel, trend, visibleTransactions } from '../lib/selectors'
import { uid } from '../lib/createState'
import type { Category, Transaction, TxKind } from '../lib/types'
import { useStore } from '../state/store'
import { parseCsv, transactionsToCsv, workbookFromTransactions } from '../lib/xlsxIo'
import { eligibleSpend, outstandingDebt } from '../lib/calc'
import { categoryFromName } from '../lib/categories'
import { ExcelUploadModal } from '../components/ExcelUploadModal'

export function ReportsPage() {
  const { state: full, setFilters } = useStore()
  const state = scopeState(full)
  const rows = visibleTransactions(state).filter((transaction) => transaction.origin === 'actual')
  const history = trend(state, state.filters.month, state.filters.month === 'all' ? 24 : 12)
  const totals = categoryTotals(rows)
  const slices = totals.slice(0, 8).map((item) => ({ id: item.id, name: categoryName(state, item.id), value: item.cents / 100, cents: item.cents }))
  const fixed = rows.filter((transaction) => transaction.kind === 'expense' && categoryById(state, transaction.categoryId)?.fixed).reduce((sum, transaction) => sum + transaction.amountCents, 0)
  const variable = rows.filter((transaction) => transaction.kind === 'expense' && !categoryById(state, transaction.categoryId)?.fixed).reduce((sum, transaction) => sum + transaction.amountCents, 0)
  const observations = unusualIncreases(rows).slice(0, 8)
  const recurring = stableCharges(rows).slice(0, 6)
  const yoy = yearComparison(state.transactions, state.filters.month)

  const [drillCategory, setDrillCategory] = useState<string | null>(null)

  const budgetRows = state.budgets.filter((budget) => budget.period === 'month' && state.filters.month !== 'all').map((budget) => ({
    name: categoryName(state, budget.categoryId),
    budget: budget.amountCents / 100,
    spent: eligibleSpend(state.transactions, budget.categoryId, { month: state.filters.month }) / 100,
  }))

  const debtSummary = outstandingDebt(state.debts)
  const confirmedAssetBalances = state.goals.filter((g) => g.currentBalanceCents !== null).reduce((sum, g) => sum + (g.currentBalanceCents ?? 0), 0)
  const hasUnknownAssets = state.goals.some((g) => g.currentBalanceCents === null)

  // Debt reduction over time
  const debtTimeline = [
    { label: 'Initial (Dec 23)', balance: 17155 },
    { label: 'After Anna Pay 1', balance: 16088 },
    { label: 'After Anna Pay 2', balance: 15128 },
    { label: 'After Anna Pay 3', balance: 12760 },
    { label: 'After Appa Pay 1', balance: 11800 },
    { label: 'Current Balance', balance: 11500 },
  ]

  const drillRows = drillCategory
    ? rows.filter((r) => r.categoryId === drillCategory).slice(0, 15)
    : []

  return (
    <div className="stack" style={{ gap: 18 }}>
      <header className="page-head">
        <div>
          <h1>Financial Analytics &amp; Interactive Reports</h1>
          <p>{periodLabel(state)}. Dynamic charts reflect current filters. Click any category slice to inspect underlying records.</p>
        </div>
      </header>

      {/* Income vs Expenses & Savings Rate */}
      <div className="grid-2">
        <ChartChrome
          title="Monthly Income versus Expenses"
          hint="Cash inflows against living expenses across all periods"
          actions={<Badge tone="ok">Actuals</Badge>}
        >
          <div className="chart">
            <ResponsiveContainer>
              <BarChart data={history}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value) => formatMoney(Math.round(Number(value) * 100))}
                />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expenses" fill="#64748b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartChrome>

        <ChartChrome
          title="Savings Rate Trend Over Time"
          hint="Savings percentage of net salary per calendar month"
          actions={<Badge tone="ok">Ratio</Badge>}
        >
          <div className="chart">
            <ResponsiveContainer>
              <LineChart data={history}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value) => formatPercent(Number(value))}
                />
                <Line dataKey="rate" name="Savings Rate (%)" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartChrome>
      </div>

      {/* Expenses by Category & Fixed vs Variable */}
      <div className="grid-2">
        <ChartChrome
          title="Expenses by Category (Click to Drill Down)"
          hint="Proportional breakdown of total living costs"
          actions={drillCategory ? <Badge tone="ok">{categoryName(state, drillCategory)}</Badge> : <Badge>Click slice</Badge>}
        >
          {slices.length === 0 ? (
            <Empty title="No expenses in this filter" body="Try another month or clear the category filter." />
          ) : (
            <div className="chart">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                    cursor="pointer"
                    onClick={(item) => {
                      if (item && 'id' in item && item.id) {
                        setDrillCategory(String(item.id))
                      }
                    }}
                  >
                    {slices.map((slice) => (
                      <Cell key={slice.id} fill={colorFor(slice.id)} opacity={drillCategory && drillCategory !== slice.id ? 0.35 : 1} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(value) => formatMoney(Math.round(Number(value) * 100))}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartChrome>

        <Panel title="Fixed versus Variable Cost Split">
          <div className="stack" style={{ gap: 12 }}>
            <div className="row-card">
              <div>
                <strong>Fixed Obligations</strong>
                <div className="muted" style={{ fontSize: '0.8rem' }}>Contracted rent, insurance, phone, travel ticket</div>
              </div>
              <strong style={{ fontSize: '1.1rem' }}>{formatMoney(fixed)}</strong>
            </div>
            <div className="row-card">
              <div>
                <strong>Variable Spending</strong>
                <div className="muted" style={{ fontSize: '0.8rem' }}>Food, cooking, eating out, shopping, leisure</div>
              </div>
              <strong style={{ fontSize: '1.1rem' }}>{formatMoney(variable)}</strong>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span className="muted">Fixed cost ratio:</span>
                <strong>{fixed + variable > 0 ? formatPercent((fixed / (fixed + variable)) * 100) : '—'}</strong>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* Category Drilldown Table if user clicked a slice */}
      {drillCategory ? (
        <Panel
          title={`Detailed Transactions: ${categoryName(state, drillCategory)}`}
          extra={<button type="button" className="btn ghost" onClick={() => setDrillCategory(null)}>Close drilldown</button>}
        >
          {drillRows.length === 0 ? (
            <p className="muted">No transactions in this category for the active filter.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th className="num">Amount</th>
                    <th>Account</th>
                  </tr>
                </thead>
                <tbody>
                  {drillRows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.date}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <CategoryBadge category={r.categoryId} size="small" />
                          <span>{r.description || categoryName(state, r.categoryId)}</span>
                        </div>
                      </td>
                      <td className="num">{formatMoney(r.amountCents)}</td>
                      <td className="meta">{r.account || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : null}

      {/* Year over Year Comparison (if data exists) */}
      {yoy ? (
        <Panel title={`Year-over-Year Comparison (${state.filters.month} vs prior year)`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div className="brief-card">
              <span className="brief-q">This Year Net Income</span>
              <span className="brief-val tone-good">{formatMoney(yoy.current.incomeCents)}</span>
              <span className="brief-detail">Prior year: {formatMoney(yoy.previous.incomeCents)}</span>
            </div>
            <div className="brief-card">
              <span className="brief-q">This Year Spending</span>
              <span className="brief-val tone-bad">{formatMoney(yoy.current.expenseCents)}</span>
              <span className="brief-detail">Prior year: {formatMoney(yoy.previous.expenseCents)}</span>
            </div>
          </div>
        </Panel>
      ) : null}

      {/* Actual vs Budget & Debt Reduction Curve */}
      <div className="grid-2">
        <ChartChrome
          title="Actual Spending vs. Allocated Budget"
          hint="Performance against monthly category spending caps"
        >
          {budgetRows.length === 0 ? (
            <Empty title="No active monthly budgets in this view" body="Set category budgets on the Budgets page to view limit compliance." />
          ) : (
            <div className="chart">
              <ResponsiveContainer>
                <BarChart data={budgetRows}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(value) => formatMoney(Math.round(Number(value) * 100))}
                  />
                  <Bar dataKey="budget" name="Budget" fill="#94a3b8" />
                  <Bar dataKey="spent" name="Spent" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartChrome>

        <ChartChrome
          title="Historical Debt Reduction Curve"
          hint="Chronological amortization trajectory across all repayments"
          actions={<Badge tone="ok">Amortization</Badge>}
        >
          <div className="chart">
            <ResponsiveContainer>
              <LineChart data={debtTimeline}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value) => formatMoney(Math.round(Number(value) * 100))}
                />
                <Line dataKey="balance" name="Total Outstanding (€)" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartChrome>
      </div>

      {/* Net Worth Balance Sheet */}
      <Panel title="Net Worth Balance Sheet (Assets &amp; Liabilities)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
          <div className="brief-card">
            <span className="brief-q">Confirmed Assets</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--green)' }}>
              {confirmedAssetBalances > 0 ? formatMoney(confirmedAssetBalances) : 'Unknown (0 confirmed)'}
            </div>
            <span className="brief-detail">Bank deposits &amp; linked goals</span>
          </div>

          <div className="brief-card">
            <span className="brief-q">Total Liabilities</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--red)' }}>
              {formatMoney(debtSummary.cents)}
            </div>
            <span className="brief-detail">Remaining Appa loan</span>
          </div>

          <div className="brief-card">
            <span className="brief-q">Calculated Net Worth</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
              {hasUnknownAssets ? 'Incomplete' : formatMoney(confirmedAssetBalances - debtSummary.cents)}
            </div>
            <span className="brief-detail">Requires confirmed asset balances</span>
          </div>
        </div>
        <p className="muted" style={{ fontSize: '0.82rem', margin: 0 }}>
          Strict privacy rule: the application never estimates or assumes bank account balances from transaction history alone. Balances remain marked unknown until you confirm them.
        </p>
      </Panel>

      {/* Changes Backed by Records */}
      <Panel title="Significant Category Jumps (Evidence-Backed)">
        {observations.length === 0 ? (
          <p className="muted">No category rose by at least 50% and €50 against the previous recorded month in this filter.</p>
        ) : (
          <div className="list">
            {observations.map((item) => (
              <button
                type="button"
                className="row-card linkish"
                key={`${item.month}-${item.categoryId}`}
                onClick={() => {
                  setFilters({ month: item.month, categoryId: item.categoryId, kind: 'expense' })
                  location.hash = 'expenses'
                }}
              >
                <span>{categoryName(state, item.categoryId)} · {monthLabel(item.month)}</span>
                <span className="tone-bad">{formatMoney(item.previousCents)} → {formatMoney(item.currentCents)}</span>
              </button>
            ))}
          </div>
        )}
        {recurring.length ? (
          <div style={{ marginTop: 12 }}>
            <h4 style={{ margin: '0 0 6px', fontSize: '0.88rem' }}>Predictable Recurring Charges Detected</h4>
            <div className="list">
              {recurring.map((item) => (
                <div className="row-card" key={item.categoryId}>
                  <span>{categoryName(state, item.categoryId)}</span>
                  <span className="muted">Typical {formatMoney(item.typicalCents)} across {item.months} months</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
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
  return {
    current: { incomeCents: sum(currentRows, 'income'), expenseCents: sum(currentRows, 'expense') },
    previous: { incomeCents: sum(priorRows, 'income'), expenseCents: sum(priorRows, 'expense') },
  }
}

export function DataPage() {
  const { state, commitImport, replaceState } = useStore()
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [csvRows, setCsvRows] = useState<Transaction[]>([])
  const [csvCategories, setCsvCategories] = useState<Category[]>([])
  const [csvErrors, setCsvErrors] = useState<string[]>([])
  const [acceptDupes, setAcceptDupes] = useState(false)
  const duplicates = useMemo(() => findDuplicateGroups(state.transactions, csvRows), [state.transactions, csvRows])
  const diffs = state.reconciliation.filter((row) => row.differenceCents !== 0)

  function download(filename: string, blob: Blob) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <header className="page-head">
        <div>
          <h1>Data Management &amp; Excel Synchronization</h1>
          <p>
            Your financial records stay private in this browser&apos;s IndexedDB. Re-uploading <code>Expense Tracker.xlsx</code> automatically updates all workbook calculations while preserving your manual entries.
          </p>
        </div>
      </header>

      {/* Excel Upload Section */}
      <Panel title="Update Dashboard from Excel">
        <div className="stack" style={{ gap: 10 }}>
          <label className="drop" style={{ cursor: 'pointer' }} onClick={() => setUploadModalOpen(true)}>
            <strong>Drop or Click to Update Expense Tracker.xlsx</strong>
            <p className="muted" style={{ fontSize: '0.85rem', marginTop: 4 }}>
              Preview sheet differences, imported record counts, and date coverage before applying changes.
            </p>
          </label>
        </div>
      </Panel>

      <ExcelUploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onCommit={(result, fileName) => {
          commitImport(result)
          setMessage(`Successfully updated dashboard from ${fileName}! (${result.stats.transactionCount} transactions synced)`)
          setTimeout(() => setMessage(''), 5000)
        }}
      />

      {message ? <Notice>{message}</Notice> : null}

      {/* Import & Reconciliation Audit Diagnostics */}
      <Panel
        title="Workbook Reconciliation Diagnostics"
        extra={diffs.length ? <Badge tone="warn">{diffs.length} Differences</Badge> : <Badge tone="ok">Fully Reconciled</Badge>}
      >
        <p className="muted" style={{ fontSize: '0.85rem', margin: '0 0 10px' }}>
          Validates that imported transaction sums match the monthly totals reported on the original summary worksheets.
        </p>
        {state.reconciliation.length === 0 ? (
          <Empty title="No reconciliation records" body="Reconciliation rows will appear after parsing the workbook." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="num">Workbook Total</th>
                  <th className="num">Transaction Sum</th>
                  <th className="num">Discrepancy</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {state.reconciliation.slice(0, 15).map((row, index) => (
                  <tr key={index}>
                    <td>{row.month}</td>
                    <td className="num">{formatMoney(row.workbookSpendCents)}</td>
                    <td className="num">{formatMoney(row.ledgerExpenseCents)}</td>
                    <td className={`num ${row.differenceCents !== 0 ? 'tone-bad' : 'tone-good'}`}>
                      {formatMoney(row.differenceCents)}
                    </td>
                    <td className="meta">{row.notes.join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* CSV Import */}
      <Panel title="Import Additional CSV Statements">
        <div className="stack" style={{ gap: 10 }}>
          <div className="drop">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async (event) => {
                const file = event.target.files?.[0]
                if (!file) return
                const text = await file.text()
                const result = parseCsv(text)
                setCsvErrors(result.errors)
                const newTx: Transaction[] = result.rows.map((r) => {
                  const matchedCat = state.categories.find((c) => c.name.toLowerCase() === r.category.toLowerCase())
                  const categoryId = matchedCat?.id ?? categoryFromName(r.category).id
                  return {
                    id: uid('tx'),
                    date: r.date,
                    dayKnown: true,
                    description: r.description,
                    categoryId,
                    amountCents: parseAmount(r.amount) ?? 0,
                    kind: (r.type as TxKind) || 'expense',
                    account: r.account,
                    notes: r.notes,
                    origin: 'actual',
                    confidence: 'confirmed',
                    source: 'csv',
                    recurring: false,
                  }
                })
                setCsvRows(newTx)
                setCsvCategories([])
              }}
            />
            <p className="muted" style={{ fontSize: '0.85rem', marginTop: 4 }}>
              Supports comma-separated or semicolon-separated statements (Date, Description, Category, Amount).
            </p>
          </div>

          {csvErrors.length ? (
            <Notice tone="warn">
              CSV Warnings: {csvErrors.slice(0, 4).join('; ')}
            </Notice>
          ) : null}

          {csvRows.length ? (
            <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong>Parsed {csvRows.length} transactions from CSV</strong>
                {duplicates.length ? (
                  <label className="check" style={{ fontSize: '0.85rem' }}>
                    <input type="checkbox" checked={acceptDupes} onChange={(e) => setAcceptDupes(e.target.checked)} />
                    Allow {duplicates.length} duplicate rows
                  </label>
                ) : null}
              </div>
              <button
                type="button"
                className="btn primary"
                disabled={duplicates.length > 0 && !acceptDupes}
                onClick={() => {
                  const toAdd = duplicates.length > 0 && !acceptDupes
                    ? csvRows.filter((_, idx) => !duplicates.some((d) => d.indexes.includes(idx)))
                    : csvRows
                  replaceState({
                    ...state,
                    transactions: [...state.transactions, ...toAdd],
                    categories: [...state.categories, ...csvCategories.filter((c) => !state.categories.some((ex) => ex.id === c.id))],
                  })
                  setCsvRows([])
                  setMessage(`Imported ${toAdd.length} transactions from CSV statement.`)
                  setTimeout(() => setMessage(''), 5000)
                }}
              >
                Apply CSV Import ({csvRows.length} rows)
              </button>
            </div>
          ) : null}
        </div>
      </Panel>

      {/* Export & Backup */}
      <Panel title="Export Financial Data &amp; Local Backup">
        <div className="filters">
          <button
            type="button"
            className="btn ghost"
            onClick={() => download('all-transactions.csv', new Blob([transactionsToCsv(state.transactions, (id) => categoryName(state, id))], { type: 'text/csv' }))}
          >
            Export All Transactions (CSV)
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={async () => {
              const buffer = await workbookFromTransactions(state.transactions, (id) => categoryName(state, id))
              download('finance-dashboard-export.xlsx', new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
            }}
          >
            Export Full Ledger (Excel)
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              const payload = JSON.stringify(state, null, 2)
              download(`finance-dashboard-backup-${new Date().toISOString().slice(0, 10)}.json`, new Blob([payload], { type: 'application/json' }))
            }}
          >
            Export Complete State Backup (JSON)
          </button>
        </div>
      </Panel>
    </div>
  )
}
