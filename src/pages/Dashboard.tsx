import { useEffect, useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Chip, KpiButton, PillTabs, SpendStack } from '../components/interactive'
import { Badge, Empty, Notice, Panel } from '../components/ui'
import { activeChapter, employedMonths, planCategoryTotals, scopeState } from '../lib/chapter'
import { shortMonth } from '../lib/dates'
import { unusualIncreases } from '../lib/insights'
import { formatMoney, formatPercent } from '../lib/money'
import { budgetSummary, categoryName, categoryTotals, colorFor, compare, debtSummary, figuresForMonths, knownSavingsBalance, periodLabel, previousFigures, trend } from '../lib/selectors'
import { useStore } from '../state/store'

type Focus = 'all' | 'income' | 'expense'
type SavedView = { id: string; name: string; months: string[]; focus: Focus; categoryId: string }

const VIEW_KEY = 'finance-dashboard-views'

function loadViews(): SavedView[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(VIEW_KEY) ?? '[]') as SavedView[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function Dashboard() {
  const { state: full, setFilters } = useStore()
  const state = scopeState(full)
  const employed = activeChapter(state) === 'employed'
  const actualMonths = useMemo(() => employed ? employedMonths(state) : [...new Set(state.transactions.filter((transaction) => transaction.origin === 'actual').map((transaction) => transaction.date.slice(0, 7)))].sort(), [employed, state])
  const [months, setMonths] = useState<string[]>(() => (state.filters.month === 'all' ? [] : [state.filters.month]))
  const [focus, setFocus] = useState<Focus>('all')
  const [categoryId, setCategoryId] = useState<string | null>(state.filters.categoryId === 'all' ? null : state.filters.categoryId)
  const [views, setViews] = useState<SavedView[]>(loadViews)
  const [viewName, setViewName] = useState('')
  const writtenMonth = useRef(state.filters.month)

  useEffect(() => {
    if (state.filters.month === writtenMonth.current) return
    writtenMonth.current = state.filters.month
    setMonths(state.filters.month === 'all' ? [] : [state.filters.month])
  }, [state.filters.month])

  const activeMonths = months.length ? months : employed ? actualMonths.slice(0, 12) : actualMonths
  const figures = useMemo(() => figuresForMonths(state, months), [state, months])
  const previous = months.length === 1 ? previousFigures({ ...state, filters: { ...state.filters, month: months[0] } }) : null
  const incomeDelta = compare(figures.incomeCents, previous?.incomeCents ?? null)
  const expenseDelta = compare(figures.expenseCents, previous?.expenseCents ?? null)
  const savingsDelta = compare(figures.savingsCents, previous?.savingsCents ?? null)
  const history = useMemo(() => {
    const end = months.length ? [...months].sort().at(-1) ?? state.filters.month : state.filters.month
    return trend(state, end)
  }, [months, state])
  const totals = employed ? planCategoryTotals(state, activeMonths) : categoryTotals(state.transactions.filter((transaction) => activeMonths.includes(transaction.date.slice(0, 7))))
  const slices = totals.slice(0, 8).map((item) => ({ id: item.id, name: categoryName(state, item.id), value: item.cents / 100, cents: item.cents }))
  const debt = debtSummary(state)
  const savingsBalance = knownSavingsBalance(state)
  const budgetMonth = months.length === 1 ? months[0] : state.filters.month
  const budgets = budgetSummary(state, budgetMonth)
  const planBills = state.recurring.filter((rule) => rule.kind === 'expense' && activeMonths.some((month) => month >= rule.startMonth && (!rule.endMonth || month <= rule.endMonth)))
  const alerts = unusualIncreases(state.transactions).filter((item) => activeMonths.includes(item.month)).slice(0, 4)
  const drill = state.transactions
    .filter((transaction) => transaction.origin === 'actual' && transaction.kind === 'expense' && categoryId && transaction.categoryId === categoryId && activeMonths.includes(transaction.date.slice(0, 7)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.amountCents - a.amountCents)
    .slice(0, 12)
  const sparks = {
    income: history.map((row) => row.income ?? 0),
    expense: history.map((row) => row.expense ?? 0),
    savings: history.map((row) => row.savings ?? 0),
  }

  function applyMonths(next: string[]) {
    const month = next.length === 1 ? next[0] : 'all'
    writtenMonth.current = month
    setMonths(next)
    setFilters({ month })
  }

  function toggleMonth(month: string) {
    applyMonths(months.includes(month) ? months.filter((item) => item !== month) : [...months, month])
  }

  function pickCategory(id: string) {
    const next = categoryId === id ? null : id
    setCategoryId(next)
    setFilters({ categoryId: next ?? 'all', kind: next ? 'expense' : state.filters.kind })
  }

  function saveView() {
    const name = viewName.trim() || (months.length ? months.join(', ') : 'All months')
    const next = [...views, { id: crypto.randomUUID(), name, months, focus, categoryId: categoryId ?? '' }]
    setViews(next)
    localStorage.setItem(VIEW_KEY, JSON.stringify(next))
    setViewName('')
  }

  function applyView(view: SavedView) {
    const month = view.months.length === 1 ? view.months[0] : 'all'
    writtenMonth.current = month
    setMonths(view.months)
    setFocus(view.focus)
    setCategoryId(view.categoryId || null)
    setFilters({ month, categoryId: view.categoryId || 'all' })
  }

  const filtersActive = months.length > 0 || focus !== 'all' || categoryId

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>{months.length === 0 ? periodLabel(state) : months.length === 1 ? `${employed ? 'Full-time plan' : 'Student life'} · ${months[0]}` : `${months.length} months selected`}. {employed ? 'These figures are the employment plan. Student spending is not included.' : 'These figures are student life only. The full-time salary plan is not included.'}</p>
        </div>
        {filtersActive ? <button type="button" className="btn" onClick={() => { writtenMonth.current = 'all'; setMonths([]); setFocus('all'); setCategoryId(null); setFilters({ month: 'all', categoryId: 'all', kind: 'all' }) }}>Clear</button> : null}
      </header>

      <section className="cmd">
        <div>
          <span>Month</span>
          <div className="chips">
            <Chip active={months.length === 0} onClick={() => applyMonths([])}>All</Chip>
            {(employed ? actualMonths.slice(0, 18) : actualMonths.slice(-18)).map((month) => (
              <Chip key={month} active={months.includes(month)} onClick={() => toggleMonth(month)}>
                {shortMonth(month)} <em>{month.slice(2, 4)}</em>
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <span>Chart</span>
          <PillTabs group="focus" value={focus} onChange={setFocus} items={[{ id: 'all', label: 'Income and spending' }, { id: 'income', label: 'Income' }, { id: 'expense', label: 'Spending' }]} />
        </div>
        <div>
          <span>Saved views</span>
          <div className="chips">
            {views.map((view) => (
              <Chip key={view.id} active={false} onClick={() => applyView(view)}>
                {view.name}
                <em onClick={(event) => { event.stopPropagation(); const next = views.filter((item) => item.id !== view.id); setViews(next); localStorage.setItem(VIEW_KEY, JSON.stringify(next)) }}>×</em>
              </Chip>
            ))}
            <input aria-label="Name this view" placeholder="Name this view" value={viewName} onChange={(event) => setViewName(event.target.value)} />
            <button type="button" className="btn" onClick={saveView}>Save view</button>
          </div>
        </div>
      </section>

      {!figures.hasRecords ? (
        <Notice tone="warn">
          No actual records for this selection. The latest recorded month is {state.stats?.actualEnd?.slice(0, 7) ?? 'not available'}.
          <button type="button" className="btn" style={{ marginLeft: 8 }} onClick={() => state.stats?.actualEnd && toggleMonth(state.stats.actualEnd.slice(0, 7))}>Show latest actual month</button>
        </Notice>
      ) : null}

      <section className="stat-grid">
        <KpiButton label="Net income" value={formatMoney(figures.incomeCents)} tone={incomeDelta !== null && incomeDelta < 0 ? 'bad' : incomeDelta !== null && incomeDelta > 0 ? 'good' : 'neutral'} selected={focus === 'income'} spark={sparks.income} detail={deltaText(incomeDelta, previous?.month, 'No prior month in this selection')} onClick={() => setFocus((current) => current === 'income' ? 'all' : 'income')} />
        <KpiButton label="Expenses" value={formatMoney(figures.expenseCents)} selected={focus === 'expense'} spark={sparks.expense} detail={expenseDelta === null ? 'Transfers are excluded' : `${formatMoney(Math.abs(expenseDelta))} ${expenseDelta > 0 ? 'higher' : 'lower'} than ${previous?.month}`} onClick={() => setFocus((current) => current === 'expense' ? 'all' : 'expense')} />
        <KpiButton label="Savings" value={formatMoney(figures.savingsCents)} tone={savingsDelta !== null && savingsDelta < 0 ? 'bad' : 'neutral'} spark={sparks.savings} detail={employed ? 'Estimated net minus planned living costs. Student spending is excluded.' : savingsDelta === null ? 'Income minus expenses and debt payments' : `${formatMoney(Math.abs(savingsDelta))} ${savingsDelta < 0 ? 'below' : 'above'} ${previous?.month}`} onClick={() => setFocus('all')} />
        <KpiButton label="Savings rate" value={formatPercent(figures.savingsRate)} detail={figures.incomeCents === 0 ? 'Income is zero, so the rate is undefined' : 'Savings divided by income'} onClick={() => setFocus('all')} />
        <KpiButton label="Remaining budget" value={budgets.remaining === null ? 'No budget set' : formatMoney(budgets.remaining)} tone={budgets.over ? 'bad' : 'neutral'} detail={budgets.count ? `${budgets.count} monthly budgets` : 'Set a budget to track this'} href="#budgets" />
        <KpiButton label="Outstanding debt" value={employed ? 'In student life' : formatMoney(debt.cents)} tone={!employed && debt.cents > 0 ? 'bad' : 'neutral'} detail={employed ? 'Repayments from the student workbook stay on their own' : debt.unconfirmed ? 'Workbook balance, not a confirmed statement' : 'Confirmed balances'} href="#debts" />
        <KpiButton label="Savings balances" value={savingsBalance === null ? 'Unknown' : formatMoney(savingsBalance)} detail={savingsBalance === null ? 'No confirmed account balances' : 'Sum of balances you entered'} href="#savings" />
        <KpiButton label="Planned bills" value={String(planBills.length)} detail={planBills.length ? planBills.slice(0, 2).map((rule) => rule.name).join(' · ') : 'No planned bill in this selection'} href="#calendar" />
      </section>

      <div className="grid-2">
        <Panel title="Income and spending" extra={<Badge>Click a bar to select that month</Badge>}>
          {history.every((row) => row.income === null && row.expense === null) ? <Empty title="No trend yet" body="Import or add records to see monthly income and spending." /> : (
            <div className="chart">
              <ResponsiveContainer>
                <BarChart data={history} onClick={(chart) => { const month = (chart as { activePayload?: Array<{ payload?: { month?: string } }> })?.activePayload?.[0]?.payload?.month; if (month) toggleMonth(month) }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                  <Tooltip formatter={(value) => formatMoney(Math.round(Number(value) * 100))} />
                  {(focus === 'all' || focus === 'income') && (
                    <Bar dataKey="income" name="Income" fill="#0f7b4c" radius={[4, 4, 0, 0]} cursor="pointer">
                      {history.map((row) => <Cell key={`in-${row.month}`} fillOpacity={months.length === 0 || months.includes(row.month) ? 1 : 0.28} />)}
                    </Bar>
                  )}
                  {(focus === 'all' || focus === 'expense') && (
                    <Bar dataKey="expense" name="Expenses" fill="#5c6b7a" radius={[4, 4, 0, 0]} cursor="pointer">
                      {history.map((row) => <Cell key={`ex-${row.month}`} fillOpacity={months.length === 0 || months.includes(row.month) ? 1 : 0.28} />)}
                    </Bar>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
        <Panel title="Where the money went" extra={<Badge>{categoryId ? categoryName(state, categoryId) : 'Click a category'}</Badge>}>
          {slices.length === 0 ? <Empty title="No expenses in this view" body="Categories with no entry are omitted. They are not treated as zero." /> : (
            <div className="chart">
              <ResponsiveContainer>
                <BarChart data={slices} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid stroke="var(--line)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                  <Tooltip formatter={(value) => formatMoney(Math.round(Number(value) * 100))} />
                  <Bar dataKey="value" name="Spent" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(item) => { const id = (item as { id?: string }).id; if (id) pickCategory(id) }}>
                    {slices.map((slice) => <Cell key={slice.id} fill={categoryId && categoryId !== slice.id ? '#c5ced6' : colorFor(slice.id)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <SpendStack slices={slices.slice(0, 6).map((slice) => ({ id: slice.id, label: slice.name, cents: slice.cents, color: colorFor(slice.id) }))} onPick={pickCategory} />

      {categoryId ? (
        <Panel title={`Records in ${categoryName(state, categoryId)}`} extra={<button type="button" className="btn" onClick={() => { setFilters({ categoryId, kind: 'expense', month: months.length === 1 ? months[0] : 'all' }); location.hash = 'expenses' }}>Open in Expenses</button>}>
          {drill.length === 0 ? <Empty title="No matching expenses" body="This category has no actual expense in the selected months." /> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Description</th><th>Source</th><th className="num">Amount</th></tr></thead>
                <tbody>
                  {drill.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>{transaction.dayKnown ? transaction.date : transaction.date.slice(0, 7)}</td>
                      <td>{transaction.description || categoryName(state, transaction.categoryId)}{transaction.confidence === 'needs_review' ? ' · review' : ''}</td>
                      <td className="meta">{transaction.sourceSheet ? `${transaction.sourceSheet} ${transaction.sourceCell ?? ''}` : transaction.source}</td>
                      <td className="num">{formatMoney(transaction.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : null}

      <div className="grid-2">
        <Panel title="Needs a look">
          {alerts.length === 0 ? <Empty title="No unusual category jump" body="A category is listed here when it is at least 50% and €50 above the previous month that contained it." /> : (
            <div className="list">
              {alerts.map((alert) => (
                <button type="button" className="row-card linkish" key={`${alert.month}-${alert.categoryId}`} onClick={() => { applyMonths([alert.month]); pickCategory(alert.categoryId) }}>
                  <div>
                    <strong>{categoryName(state, alert.categoryId)}</strong>
                    <div className="muted">{alert.month}: {formatMoney(alert.previousCents)} to {formatMoney(alert.currentCents)}</div>
                  </div>
                  <Badge tone="warn">Higher</Badge>
                </button>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Planned, not yet spent">
          {planBills.length === 0 ? <Empty title="No planned bill in this selection" body={employed ? 'The full-time sheet has no non-zero bill in these months.' : 'Student life has no scheduled bill in these months. The employment plan is separate.'} /> : (
            <div className="list">
              {planBills.slice(0, 8).map((rule) => (
                <div className="row-card" key={rule.id}>
                  <div><strong>{rule.name}</strong><div className="muted">{rule.startMonth}{rule.endMonth ? ` to ${rule.endMonth}` : ''}</div></div>
                  <Badge tone="warn">{formatMoney(rule.amountCents)} planned</Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}

function deltaText(delta: number | null, month: string | undefined, empty: string): string {
  if (delta === null || !month || month === 'all') return empty
  const direction = delta === 0 ? 'unchanged from' : delta > 0 ? 'above' : 'below'
  return `${formatMoney(Math.abs(delta))} ${direction} ${month}`
}
