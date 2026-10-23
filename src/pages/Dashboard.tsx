import { useEffect, useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  Wallet,
  Receipt,
  TrendingUp,
  Percent,
  Banknote,
  Target,
  Landmark,
  ShieldCheck,
  CalendarClock,
  Printer,
  Sliders,
} from 'lucide-react'
import { Chip, SpendStack } from '../components/interactive'
import { Badge, Empty, Notice, Panel } from '../components/ui'
import { ExecutiveBriefCard } from '../components/ExecutiveBriefCard'
import { KpiCard } from '../components/KpiCard'
import { ChartChrome, chartTooltipStyle } from '../components/ChartChrome'
import { CashflowHealthCard } from '../components/CashflowHealthCard'
import { CategoryBadge } from '../components/CategoryBadge'
import { FinoraHealthCard } from '../components/FinoraHealthCard'
import { FinoraTrendChart } from '../components/FinoraTrendChart'
import { FinoraQuickAdd } from '../components/FinoraQuickAdd'
import { FinoraCategoryBreakdown } from '../components/FinoraCategoryBreakdown'
import { FinoraRecentTransactions } from '../components/FinoraRecentTransactions'
import { CashflowSankey } from '../components/CashflowSankey'
import { FiftyThirtyTwentyCard } from '../components/FiftyThirtyTwentyCard'
import { CalendarSpendingHeatmap } from '../components/CalendarSpendingHeatmap'
import { DrillDownDrawer } from '../components/DrillDownDrawer'
import type { Transaction } from '../lib/types'
import { activeChapter, employedMonths, planCategoryTotals, scopeState } from '../lib/chapter'
import { addMonths, shortMonth } from '../lib/dates'
import { unusualIncreases } from '../lib/insights'
import { formatMoney } from '../lib/money'
import { computeExecutiveBrief } from '../lib/calc'
import { budgetSummary, categoryName, categoryTotals, colorFor, compare, debtSummary, figuresForMonths, knownSavingsBalance, previousFigures, trend } from '../lib/selectors'
import { useStore } from '../state/store'

type Focus = 'all' | 'income' | 'expense'
type ChartMode = 'bar' | 'donut'
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
  const { state: full, saveTransaction } = useStore()
  const state = scopeState(full)
  const employed = activeChapter(state) === 'employed'
  const actualMonths = useMemo(() => employed ? employedMonths(state) : [...new Set(state.transactions.filter((transaction) => transaction.origin === 'actual').map((transaction) => transaction.date.slice(0, 7)))].sort(), [employed, state])
  const [months, setMonths] = useState<string[]>(() => (state.filters.month === 'all' ? [] : [state.filters.month]))
  const [focus, setFocus] = useState<Focus>('all')
  const [chartMode, setChartMode] = useState<ChartMode>('bar')
  const [categoryId, setCategoryId] = useState<string | null>(state.filters.categoryId === 'all' ? null : state.filters.categoryId)
  const [views, setViews] = useState<SavedView[]>(loadViews)
  const [viewName, setViewName] = useState('')
  const writtenMonth = useRef(state.filters.month)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerTitle, setDrawerTitle] = useState('')
  const [drawerSubtitle, setDrawerSubtitle] = useState<string | undefined>()
  const [drawerTransactions, setDrawerTransactions] = useState<Transaction[]>([])

  const [visibleWidgets, setVisibleWidgets] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('cashmetry-widgets')
      return saved ? JSON.parse(saved) : { brief: true, kpis: true, trend: true, sankey: true, heatmap: true, charts: true }
    } catch {
      return { brief: true, kpis: true, trend: true, sankey: true, heatmap: true, charts: true }
    }
  })
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [hoveredSlice, setHoveredSlice] = useState<{ id: string; name: string; cents: number; pct: number } | null>(null)

  function toggleWidget(k: string) {
    setVisibleWidgets((prev) => {
      const next = { ...prev, [k]: !prev[k] }
      localStorage.setItem('cashmetry-widgets', JSON.stringify(next))
      return next
    })
  }

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

  const { needsCents, wantsCents } = useMemo(() => {
    let needs = 0
    let wants = 0
    const isNeedCategory = (id: string) => {
      const lower = id.toLowerCase()
      return (
        lower.includes('rent') || lower.includes('grocer') || lower.includes('util') ||
        lower.includes('electr') || lower.includes('heat') || lower.includes('phone') ||
        lower.includes('intern') || lower.includes('insur') || lower.includes('loan') ||
        lower.includes('debt') || lower.includes('repay') || lower.includes('educ') ||
        lower.includes('transp')
      )
    }
    for (const item of totals) {
      if (isNeedCategory(item.id)) needs += item.cents
      else wants += item.cents
    }
    return { needsCents: needs, wantsCents: wants }
  }, [totals])
  const debt = debtSummary(state)
  const savingsBalance = knownSavingsBalance(state)
  const budgetMonth = months.length === 1 ? months[0] : state.filters.month
  const budgets = budgetSummary(state, budgetMonth)
  const totalMonthlyBudgetCents = useMemo(
    () => state.budgets.filter((b) => b.period === 'month').reduce((sum, b) => sum + b.amountCents, 0),
    [state.budgets]
  )
  const planBills = state.recurring.filter((rule) => rule.kind === 'expense' && activeMonths.some((month) => month >= rule.startMonth && (!rule.endMonth || month <= rule.endMonth)))
  const alerts = unusualIncreases(state.transactions).filter((item) => activeMonths.includes(item.month)).slice(0, 4)
  const drill = state.transactions
    .filter((transaction) => transaction.origin === 'actual' && transaction.kind === 'expense' && categoryId && transaction.categoryId === categoryId && activeMonths.includes(transaction.date.slice(0, 7)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.amountCents - a.amountCents)
    .slice(0, 20)

  const trailingExpenseAvgCents = useMemo(() => {
    if (activeMonths.length === 0) return null
    const currentM = activeMonths[0]
    const prior3 = [addMonths(currentM, -1), addMonths(currentM, -2), addMonths(currentM, -3)]
    const priorExpenses = prior3.map((m) => {
      const f = figuresForMonths(state, [m])
      return f.expenseCents
    }).filter((c): c is number => c !== null)
    if (priorExpenses.length === 0) return null
    return Math.round(priorExpenses.reduce((a, b) => a + b, 0) / priorExpenses.length)
  }, [activeMonths, state])

  const brief = useMemo(() => {
    const monthName = months.length === 1 ? months[0] : months.length > 1 ? `${months.length} months selected` : (employed ? 'Full-Time Plan' : 'All Recorded Months')
    return computeExecutiveBrief({
      month: monthName,
      incomeCents: figures.incomeCents,
      expenseCents: figures.expenseCents,
      savingsCents: figures.savingsCents,
      savingsRate: figures.savingsRate,
      debtPaymentCents: figures.debtPaymentCents,
      transferCents: figures.transferCents,
      savingsContributionCents: figures.savingsContributionCents,
      priorIncomeCents: previous?.incomeCents ?? null,
      priorExpenseCents: previous?.expenseCents ?? null,
      topCategories: slices.map((s) => ({ name: s.name, cents: s.cents })),
      budgetSummary: budgets,
      debtCents: debt.cents,
      trailingExpenseAvgCents,
      isEmployed: employed,
    })
  }, [months, employed, figures, previous, slices, budgets, debt.cents, trailingExpenseAvgCents])

  const sparks = useMemo(() => {
    const recent = history.slice(-6)
    return {
      income: recent.map((r) => (r.income ?? 0) / 100),
      expense: recent.map((r) => (r.expense ?? 0) / 100),
      savings: recent.map((r) => ((r.income ?? 0) - (r.expense ?? 0)) / 100),
    }
  }, [history])

  function toggleMonth(target: string) {
    setMonths((current) => current.includes(target) ? current.filter((m) => m !== target) : [...current, target].sort())
  }
  function setRange(count: number) {
    setMonths(actualMonths.slice(-count))
  }
  function pickCategory(id: string) {
    setCategoryId((current) => current === id ? null : id)
    const catTxs = state.transactions.filter((t) => t.categoryId === id && (activeMonths.length === 0 || activeMonths.includes(t.date.slice(0, 7))))
    if (catTxs.length > 0) {
      setDrawerTitle(`${categoryName(state, id)} Ledger`)
      setDrawerSubtitle(`${catTxs.length} transaction${catTxs.length === 1 ? '' : 's'} across selected period`)
      setDrawerTransactions(catTxs)
      setDrawerOpen(true)
    }
  }
  function saveView() {
    if (!viewName.trim()) return
    const next: SavedView = { id: String(Date.now()), name: viewName.trim(), months, focus, categoryId: categoryId ?? 'all' }
    const updated = [...views.filter((v) => v.name !== next.name), next]
    setViews(updated)
    localStorage.setItem(VIEW_KEY, JSON.stringify(updated))
    setViewName('')
  }
  function applyView(view: SavedView) {
    setMonths(view.months)
    setFocus(view.focus)
    setCategoryId(view.categoryId === 'all' ? null : view.categoryId)
  }
  function removeView(id: string) {
    const updated = views.filter((v) => v.id !== id)
    setViews(updated)
    localStorage.setItem(VIEW_KEY, JSON.stringify(updated))
  }

  function deltaText(delta: number | null, prevMonth: string | undefined, emptyLabel: string) {
    if (delta === null) return emptyLabel
    const diff = formatMoney(Math.abs(delta))
    return `${diff} ${delta >= 0 ? 'higher' : 'lower'} than ${prevMonth ?? 'prior'}`
  }

  const healthScore = useMemo(() => {
    let score = 70
    if (figures.incomeCents && figures.incomeCents > 0) {
      const rate = figures.savingsRate ?? 0
      score += Math.min(25, Math.max(-25, Math.round(rate * 0.8)))
    }
    if ((brief.spentCents ?? 0) > 0) {
      if (budgets.remaining !== null && budgets.remaining >= 0) score += 10
      else if (budgets.over) score -= 15
    }
    if (debt.cents === 0) score += 10
    else if (debt.cents > 1000000) score -= 5
    return Math.max(15, Math.min(100, score))
  }, [figures, brief, budgets, debt.cents])

  const runwayMonths = useMemo(() => {
    if (!trailingExpenseAvgCents || trailingExpenseAvgCents <= 0) return null
    const buffer = brief.availableCashCents || brief.earnedCents || 0
    return buffer > 0 ? buffer / trailingExpenseAvgCents : null
  }, [trailingExpenseAvgCents, brief])

  function handleAddQuickTransaction(tx: {
    description: string
    amountCents: number
    categoryId: string
    kind: 'expense' | 'income'
  }) {
    saveTransaction(
      {
        id: `manual:${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        dayKnown: true,
        description: tx.description,
        categoryId: tx.categoryId,
        amountCents: tx.amountCents,
        kind: tx.kind,
        account: '',
        notes: 'Quick-added from Dashboard',
        origin: 'actual',
        confidence: 'confirmed',
        source: 'manual',
        chapter: activeChapter(state),
        recurring: false,
      },
      true
    )
  }

  const netSavingsMargin = useMemo(() => {
    if (!figures.incomeCents || figures.incomeCents <= 0) return null
    const savings = figures.savingsCents ?? (figures.incomeCents - (figures.expenseCents ?? 0))
    return (savings / figures.incomeCents) * 100
  }, [figures])

  const savingsMilestone = useMemo(() => {
    const rate = figures.savingsRate ?? 0
    if (rate >= 50) return { label: 'FIRE Ready (50%+)', badge: 'FIRE Ready' }
    if (rate >= 40) return { label: 'Gold Wealth Builder (40%+)', badge: 'Gold Builder' }
    if (rate >= 20) return { label: 'Silver Saver (20%+)', badge: 'Silver Saver' }
    return { label: 'Bronze Starter (<20%)', badge: 'Bronze Starter' }
  }, [figures.savingsRate])

  return (
    <div className="stack" style={{ gap: 18 }}>
      {/* Executive Financial Brief - 8 core questions answered upfront */}
      {visibleWidgets.brief !== false && <ExecutiveBriefCard brief={brief} />}

      {/* Top Filter and Perspective Controls */}
      <div className="cmd" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <span>Time span</span>
          <div className="chips">
            <button type="button" className={`btn ghost ${months.length === 0 ? 'active' : ''}`} style={{ fontSize: '0.8rem', padding: '4px 10px' }} onClick={() => setMonths([])}>All ({actualMonths.length})</button>
            <button type="button" className="btn ghost" style={{ fontSize: '0.8rem', padding: '4px 10px' }} onClick={() => setRange(3)}>Last 3m</button>
            <button type="button" className="btn ghost" style={{ fontSize: '0.8rem', padding: '4px 10px' }} onClick={() => setRange(6)}>Last 6m</button>
            <button type="button" className="btn ghost" style={{ fontSize: '0.8rem', padding: '4px 10px' }} onClick={() => setRange(12)}>Last 12m</button>
            {actualMonths.map((m) => (
              <Chip key={m} active={months.includes(m)} onClick={() => toggleMonth(m)}>
                {shortMonth(m)}
              </Chip>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>Saved views</span>
          <div className="chips">
            {views.map((view) => (
              <button key={view.id} type="button" className="chip" onClick={() => applyView(view)}>
                {view.name}
                <em onClick={(e) => { e.stopPropagation(); removeView(view.id) }}>✕</em>
              </button>
            ))}
            <input placeholder="Name view" value={viewName} onChange={(e) => setViewName(e.target.value)} style={{ width: 100, padding: '3px 8px', fontSize: '0.8rem' }} />
            <button type="button" className="btn ghost" style={{ fontSize: '0.8rem', padding: '3px 8px' }} onClick={saveView}>Save</button>
          </div>

          <button
            type="button"
            className={`btn ghost ${customizeOpen ? 'active' : ''}`}
            style={{ fontSize: '0.8rem', padding: '4px 10px' }}
            onClick={() => setCustomizeOpen((c) => !c)}
            title="Customize Cockpit Widgets (Item 14)"
          >
            <Sliders size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            <span>Customize</span>
          </button>

          <button
            type="button"
            className="btn ghost"
            style={{ fontSize: '0.8rem', padding: '4px 10px' }}
            onClick={() => window.print()}
            title="Generate Compact Printable Financial Statement (PDF - Item 16)"
          >
            <Printer size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {customizeOpen && (
        <div style={{ padding: '12px 16px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '0.8rem' }}>Visible Cockpit Widgets:</strong>
          {[
            { id: 'brief', label: 'Executive Brief' },
            { id: 'kpis', label: 'Hero KPIs' },
            { id: 'trend', label: '6-Month Visualizer' },
            { id: 'sankey', label: 'Cashflow Sankey & 50/30/20' },
            { id: 'heatmap', label: 'Spending Heatmap' },
            { id: 'charts', label: 'Category & Trends' },
          ].map((w) => (
            <label key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={visibleWidgets[w.id] !== false} onChange={() => toggleWidget(w.id)} />
              <span>{w.label}</span>
            </label>
          ))}
        </div>
      )}

      {alerts.length ? (
        <Notice tone="warn">
          <strong>Spending alert:</strong> {alerts.map((item) => `${categoryName(state, item.categoryId)} rose by ${formatMoney(item.currentCents - item.previousCents)} in ${item.month}`).join(' · ')}
        </Notice>
      ) : null}

      {/* 1. Hero KPI Metric Cards Grid featuring Finora Health Card on the top left */}
      <section className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <FinoraHealthCard
          score={healthScore}
          runwayMonths={runwayMonths}
          savingsCents={figures.savingsCents ?? 0}
        />
        <KpiCard
          label="Net Balance / Savings"
          value={(figures.savingsCents ?? 0) / 100}
          icon={TrendingUp}
          tone={(figures.savingsCents ?? 0) >= 0 ? 'positive' : 'negative'}
          badge={(figures.savingsCents ?? 0) >= 0 ? 'Surplus' : 'Deficit'}
          trend={previous?.savingsCents && figures.savingsCents !== null && previous.savingsCents !== 0 ? ((figures.savingsCents - previous.savingsCents) / Math.abs(previous.savingsCents)) * 100 : null}
          spark={sparks.savings}
          hint={employed ? 'Estimated net minus planned living costs' : savingsDelta === null ? 'Income minus living expenses' : `${formatMoney(Math.abs(savingsDelta))} ${savingsDelta < 0 ? 'below' : 'above'} ${previous?.month}`}
          onClick={() => setFocus('all')}
        />
        <KpiCard
          label="Monthly Net Income"
          value={(figures.incomeCents ?? 0) / 100}
          icon={Wallet}
          tone={incomeDelta !== null && incomeDelta > 0 ? 'positive' : incomeDelta !== null && incomeDelta < 0 ? 'negative' : 'neutral'}
          trend={previous?.incomeCents && figures.incomeCents !== null && previous.incomeCents > 0 ? ((figures.incomeCents - previous.incomeCents) / previous.incomeCents) * 100 : null}
          spark={sparks.income}
          hint={deltaText(incomeDelta, previous?.month, 'No prior month in view')}
          selected={focus === 'income'}
          onClick={() => setFocus((current) => current === 'income' ? 'all' : 'income')}
        />
        <KpiCard
          label="Total Living Expenses"
          value={(figures.expenseCents ?? 0) / 100}
          icon={Receipt}
          tone="neutral"
          trend={previous?.expenseCents && figures.expenseCents !== null && previous.expenseCents > 0 ? ((figures.expenseCents - previous.expenseCents) / previous.expenseCents) * 100 : null}
          spark={sparks.expense}
          hint={expenseDelta === null ? 'Transfers & debt payments excluded' : `${formatMoney(Math.abs(expenseDelta))} ${expenseDelta > 0 ? 'higher' : 'lower'} than ${previous?.month}`}
          selected={focus === 'expense'}
          onClick={() => setFocus((current) => current === 'expense' ? 'all' : 'expense')}
        />
      </section>

      {/* 2. Main Two-Column Layout from Finora Prototype (Chart + Quick Add & Categories + Recent Table) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {/* Left Column: 6-Month Visualizer + Recent Transactions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          <FinoraTrendChart
            data={history}
            netSavingsMargin={netSavingsMargin}
            averageExpenseCents={trailingExpenseAvgCents}
            activeMonth={months.length === 1 ? months[0] : undefined}
            onSelectMonth={toggleMonth}
          />
          <FinoraRecentTransactions
            transactions={state.transactions.filter((t) => t.origin === 'actual')}
            onViewAll={() => { window.location.hash = 'expenses' }}
          />
        </div>

        {/* Right Column: Quick Add Transaction + Category Spend Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          <FinoraQuickAdd
            categories={state.categories}
            onAddTransaction={handleAddQuickTransaction}
          />
          <FinoraCategoryBreakdown
            slices={slices}
            totalCents={figures.expenseCents ?? 0}
            onCategoryClick={pickCategory}
            selectedId={categoryId}
          />
        </div>
      </div>

      {/* 3. Secondary Financial Indicators */}
      <section className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <KpiCard
          label="Savings Rate"
          value={figures.savingsRate !== null ? figures.savingsRate : 0}
          format={(v) => `${v.toFixed(1)}%`}
          icon={Percent}
          tone={figures.savingsRate !== null && figures.savingsRate >= 20 ? 'positive' : 'neutral'}
          badge={savingsMilestone.badge}
          hint={`Milestone: ${savingsMilestone.label}`}
          onClick={() => setFocus('all')}
        />
        <KpiCard
          label="Available Cash Buffer"
          value={brief.availableCashCents ? brief.availableCashCents / 100 : 0}
          icon={Banknote}
          tone={brief.availableCashCents && brief.availableCashCents > 0 ? 'positive' : 'neutral'}
          badge={brief.availableCashCents && brief.availableCashCents > 0 ? 'Liquid' : undefined}
          hint="Cash after expenses, debt payments & goals"
          onClick={() => setFocus('all')}
        />
        <KpiCard
          label="Remaining Budget"
          value={budgets.remaining !== null ? budgets.remaining / 100 : 0}
          icon={Target}
          tone={budgets.over ? 'negative' : 'positive'}
          badge={budgets.over ? 'Over budget' : budgets.remaining !== null ? 'On track' : undefined}
          hint={budgets.count ? `${budgets.count} category budgets active` : 'Set category budgets'}
          onClick={() => { window.location.hash = 'budgets' }}
        />
        <KpiCard
          label="Outstanding Debt"
          value={employed ? 0 : debt.cents / 100}
          icon={Landmark}
          tone={!employed && debt.cents > 0 ? 'negative' : 'positive'}
          badge={employed ? 'Debt free' : debt.cents > 0 ? 'Active loans' : 'Paid off'}
          hint={employed ? 'Full-time plan has zero debt' : debt.unconfirmed ? 'Appa €11.5k; Anna completed' : 'Confirmed balances'}
          onClick={() => { window.location.hash = 'debts' }}
        />
        <KpiCard
          label="Confirmed Balances"
          value={savingsBalance !== null ? savingsBalance / 100 : 0}
          icon={ShieldCheck}
          badge={savingsBalance === null ? 'Goals active' : 'Confirmed'}
          hint={savingsBalance === null ? 'ETF, SIP, Gold, Emergency goals active' : 'Confirmed account balances'}
          onClick={() => { window.location.hash = 'savings' }}
        />
        <KpiCard
          label="Upcoming Bills"
          value={planBills.length}
          format={(n) => `${Math.round(n)} bills`}
          icon={CalendarClock}
          hint={planBills.length ? planBills.slice(0, 2).map((r) => r.name).join(' · ') : 'No planned bills this month'}
          onClick={() => { window.location.hash = 'calendar' }}
        />
      </section>

      {/* Cashflow Health & Monthly Budget Gauge (from finora) */}
      <CashflowHealthCard
        incomeCents={figures.incomeCents ?? 0}
        expenseCents={figures.expenseCents ?? 0}
        savingsCents={figures.savingsCents ?? 0}
        savingsRate={figures.savingsRate}
        budgetCents={totalMonthlyBudgetCents}
        periodLabel={months.length === 1 ? months[0] : months.length > 1 ? `${months.length} Months Active` : (employed ? 'Full-Time Plan' : 'All Months')}
      />

      {/* Visual Cashflow Distribution & 50/30/20 Rule Balance */}
      <div className="grid-2">
        <CashflowSankey
          incomeCents={figures.incomeCents ?? 0}
          fixedExpenseCents={needsCents}
          variableExpenseCents={wantsCents}
          debtPaymentCents={figures.debtPaymentCents ?? 0}
          savingsCents={figures.savingsCents ?? 0}
          investmentsCents={figures.savingsContributionCents ?? 0}
        />
        <FiftyThirtyTwentyCard
          incomeCents={figures.incomeCents ?? 0}
          needsCents={needsCents}
          wantsCents={wantsCents}
          savingsCents={figures.savingsCents ?? 0}
        />
      </div>

      {/* GitHub-Style 31-Day Spending Heatmap */}
      <CalendarSpendingHeatmap
        month={months.length === 1 ? months[0] : (state.filters.month !== 'all' ? state.filters.month : '2026-02')}
        transactions={state.transactions}
        onDayClick={(dateStr) => {
          const dayTxs = state.transactions.filter((t) => t.date === dateStr && (t.kind === 'expense' || t.kind === 'debt_payment'))
          setDrawerTitle(`Spending on ${dateStr}`)
          setDrawerSubtitle(`${dayTxs.length} transaction${dayTxs.length === 1 ? '' : 's'}`)
          setDrawerTransactions(dayTxs)
          setDrawerOpen(true)
        }}
      />

      {/* Main Charts Grid with ChartChrome wrapper */}
      <div className="grid-2">
        <ChartChrome
          title="Income versus Expenses"
          hint="Click any bar to filter that specific month"
          actions={<Badge tone="ok">Actuals</Badge>}
        >
          {history.every((row) => row.income === null && row.expense === null) ? (
            <Empty title="No trend yet" body="Import or add records to see monthly income and spending." />
          ) : (
            <div className="chart">
              <ResponsiveContainer>
                <BarChart
                  data={history}
                  onClick={(chart) => {
                    const month = (chart as { activePayload?: Array<{ payload?: { month?: string } }> })?.activePayload?.[0]?.payload?.month
                    if (month) toggleMonth(month)
                  }}
                >
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(value) => formatMoney(Math.round(Number(value) * 100))}
                  />
                  {(focus === 'all' || focus === 'income') && (
                    <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} cursor="pointer">
                      {history.map((row) => (
                        <Cell key={`in-${row.month}`} fillOpacity={months.length === 0 || months.includes(row.month) ? 1 : 0.28} />
                      ))}
                    </Bar>
                  )}
                  {(focus === 'all' || focus === 'expense') && (
                    <Bar dataKey="expense" name="Expenses" fill="#64748b" radius={[4, 4, 0, 0]} cursor="pointer">
                      {history.map((row) => (
                        <Cell key={`ex-${row.month}`} fillOpacity={months.length === 0 || months.includes(row.month) ? 1 : 0.28} />
                      ))}
                    </Bar>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartChrome>

        <ChartChrome
          title="Where Most of the Money Goes"
          hint="Largest spending categories for selected period"
          actions={
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                type="button"
                className={`btn ghost ${chartMode === 'bar' ? 'active' : ''}`}
                style={{ fontSize: '0.78rem', padding: '3px 8px' }}
                onClick={() => setChartMode('bar')}
              >
                Bar
              </button>
              <button
                type="button"
                className={`btn ghost ${chartMode === 'donut' ? 'active' : ''}`}
                style={{ fontSize: '0.78rem', padding: '3px 8px' }}
                onClick={() => setChartMode('donut')}
              >
                Donut
              </button>
              {categoryId ? <Badge tone="ok">{categoryName(state, categoryId)}</Badge> : null}
            </div>
          }
        >
          {slices.length === 0 ? (
            <Empty title="No expenses in this view" body="Categories with no entry are omitted. They are never treated as zero." />
          ) : chartMode === 'bar' ? (
            <div className="chart">
              <ResponsiveContainer>
                <BarChart data={slices} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid stroke="var(--line)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(value) => formatMoney(Math.round(Number(value) * 100))}
                  />
                  <Bar
                    dataKey="value"
                    name="Spent"
                    radius={[0, 4, 4, 0]}
                    cursor="pointer"
                    onClick={(item) => {
                      const id = (item as { id?: string }).id
                      if (id) pickCategory(id)
                    }}
                  >
                    {slices.map((slice) => (
                      <Cell key={slice.id} fill={categoryId && categoryId !== slice.id ? '#94a3b8' : colorFor(slice.id)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="chart" style={{ position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  textAlign: 'center',
                }}
              >
                <span className="muted" style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  {hoveredSlice ? hoveredSlice.name : 'Total'}
                </span>
                <strong style={{ fontSize: '0.98rem', fontWeight: 800 }}>
                  {hoveredSlice ? formatMoney(hoveredSlice.cents) : formatMoney(figures.expenseCents ?? 0)}
                </strong>
                <span className="muted" style={{ fontSize: '0.66rem' }}>
                  {hoveredSlice ? `${hoveredSlice.pct}% of spend` : `${slices.length} categories`}
                </span>
              </div>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={2}
                    cursor="pointer"
                    onMouseEnter={(item) => {
                      const id = (item as { id?: string }).id
                      const slice = slices.find((s) => s.id === id)
                      if (slice) {
                        const total = figures.expenseCents || 1
                        const pct = Math.round((slice.cents / total) * 100)
                        setHoveredSlice({ id: slice.id, name: slice.name, cents: slice.cents, pct })
                      }
                    }}
                    onMouseLeave={() => setHoveredSlice(null)}
                    onClick={(item) => {
                      if (item && 'id' in item && item.id) pickCategory(String(item.id))
                    }}
                  >
                    {slices.map((slice) => (
                      <Cell key={slice.id} fill={colorFor(slice.id)} opacity={categoryId && categoryId !== slice.id ? 0.35 : 1} />
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
      </div>

      {/* Proportional Spend Track */}
      {slices.length > 0 ? (
        <Panel title="Spending Distribution by Category">
          <SpendStack slices={slices.map((s) => ({ id: s.id, label: s.name, cents: s.cents, color: colorFor(s.id) }))} onPick={pickCategory} />
        </Panel>
      ) : null}

      {/* Category Drilldown */}
      {categoryId ? (
        <Panel
          title={`Transactions for ${categoryName(state, categoryId)}`}
          extra={
            <button type="button" className="btn ghost" onClick={() => setCategoryId(null)}>
              Clear filter
            </button>
          }
        >
          {drill.length === 0 ? (
            <Empty title="No transactions" body="There are no individual records for this category in the selected period." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th className="num">Amount</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {drill.map((t) => (
                    <tr key={t.id}>
                      <td>{t.date}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <CategoryBadge category={t.categoryId} size="small" />
                          <span>{t.description || categoryName(state, t.categoryId)}</span>
                        </div>
                      </td>
                      <td className="num">{formatMoney(t.amountCents)}</td>
                      <td className="meta">{t.sourceSheet ? `${t.sourceSheet} ${t.sourceCell ?? ''}` : t.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : null}

      <DrillDownDrawer
        open={drawerOpen}
        title={drawerTitle}
        subtitle={drawerSubtitle}
        transactions={drawerTransactions}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  )
}
