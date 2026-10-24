import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Target, Receipt, Wallet, Percent, AlertTriangle } from 'lucide-react'
import { Badge, Empty, Panel, Progress } from '../components/ui'
import { KpiCard } from '../components/KpiCard'
import { ChartChrome, chartTooltipStyle } from '../components/ChartChrome'
import { EuroInput } from '../components/EuroInput'
import { CategoryBadge } from '../components/CategoryBadge'
import { SpendingVelocityCard } from '../components/SpendingVelocityCard'
import { DrillDownDrawer } from '../components/DrillDownDrawer'
import type { Transaction } from '../lib/types'
import { applyBudget, budgetStatus, eligibleSpend, projectMonthEnd } from '../lib/calc'
import { addMonths } from '../lib/dates'
import { formatMoney, formatPercent } from '../lib/money'
import { categoryName } from '../lib/selectors'
import { uid } from '../lib/createState'
import { scopeState } from '../lib/chapter'
import { unusualIncreases } from '../lib/insights'
import { useStore } from '../state/store'

export function BudgetsPage() {
  const { state: full, saveBudget, deleteBudget } = useStore()
  const state = scopeState(full)

  const [periodTab, setPeriodTab] = useState<'month' | 'year'>('month')
  const [envelopeRollover, setEnvelopeRollover] = useState(false)
  const month = state.filters.month === 'all' ? (state.stats?.actualEnd?.slice(0, 7) ?? '2026-02') : state.filters.month
  const currentYear = Number(month.slice(0, 4))
  const previousMonth = month ? addMonths(month, -1) : ''
  const previousYear = currentYear - 1

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerTitle, setDrawerTitle] = useState('')
  const [drawerSubtitle, setDrawerSubtitle] = useState<string | undefined>()
  const [drawerTransactions, setDrawerTransactions] = useState<Transaction[]>([])

  function openCategoryDrilldown(catId: string, catName: string) {
    const periodTxs = state.transactions.filter((t) => {
      if (t.categoryId !== catId || t.kind !== 'expense') return false
      if (periodTab === 'month') {
        return t.date.slice(0, 7) === month
      } else {
        return t.date.startsWith(String(currentYear))
      }
    })
    setDrawerTitle(`${catName} Spending Ledger`)
    setDrawerSubtitle(`${periodTxs.length} transaction${periodTxs.length === 1 ? '' : 's'} recorded in ${periodTab === 'month' ? month : currentYear}`)
    setDrawerTransactions(periodTxs)
    setDrawerOpen(true)
  }

  // Filter categories and map budgets
  const rows = useMemo(() => {
    return state.categories
      .filter((category) => category.active && category.kind === 'expense')
      .map((category) => {
        const budget = state.budgets.find(
          (item) => item.categoryId === category.id && item.period === periodTab
        )
        const applied = budget
          ? applyBudget(budget, state.transactions, month)
          : null

        const spent = periodTab === 'year'
          ? eligibleSpend(state.transactions, category.id, { year: currentYear })
          : eligibleSpend(state.transactions, category.id, { month })

        const prior = periodTab === 'year'
          ? eligibleSpend(state.transactions, category.id, { year: previousYear })
          : eligibleSpend(state.transactions, category.id, { month: previousMonth })

        const priorUnspent = Math.max(0, (budget?.amountCents ?? 0) - prior)
        const effectiveAmountCents = (budget?.amountCents ?? 0) + (envelopeRollover ? priorUnspent : 0)

        const projected = periodTab === 'month'
          ? projectMonthEnd(spent, month, new Date())
          : null

        return { category, budget, applied, spent, prior, priorUnspent, effectiveAmountCents, projected }
      })
      .filter(
        (row) =>
          row.budget ||
          row.spent > 0 ||
          state.transactions.some(
            (t) => t.categoryId === row.category.id && t.kind === 'expense'
          )
      )
  }, [state.categories, state.budgets, state.transactions, periodTab, month, currentYear, previousMonth, previousYear, envelopeRollover])

  // Fixed vs Variable aggregations
  const costBreakdown = useMemo(() => {
    let fixedBudget = 0
    let variableBudget = 0
    let fixedSpent = 0
    let variableSpent = 0

    for (const r of rows) {
      if (r.category.fixed) {
        fixedBudget += r.budget?.amountCents ?? 0
        fixedSpent += r.spent
      } else {
        variableBudget += r.budget?.amountCents ?? 0
        variableSpent += r.spent
      }
    }
    return { fixedBudget, variableBudget, fixedSpent, variableSpent }
  }, [rows])

  // Total summary
  const totalBudgetCents = rows.reduce((acc, r) => acc + (r.budget?.amountCents ?? 0), 0)
  const totalSpentCents = rows.reduce((acc, r) => acc + r.spent, 0)
  const totalRemainingCents = totalBudgetCents - totalSpentCents
  const totalUtilisation = totalBudgetCents > 0 ? (totalSpentCents / totalBudgetCents) * 100 : null

  const { daysElapsed, totalDaysInMonth } = useMemo(() => {
    const parts = (month || '2026-02').split('-')
    const y = parseInt(parts[0], 10) || 2026
    const m = parseInt(parts[1], 10) || 2
    const daysInMonth = new Date(y, m, 0).getDate()
    const now = new Date()
    const isCurrentMonth = now.getFullYear() === y && (now.getMonth() + 1) === m
    const elapsed = isCurrentMonth ? Math.min(daysInMonth, now.getDate()) : daysInMonth
    return { daysElapsed: elapsed, totalDaysInMonth: daysInMonth }
  }, [month])

  // Unusual increases
  const alerts = useMemo(
    () => unusualIncreases(state.transactions).filter((item) => item.month === month).slice(0, 5),
    [state.transactions, month]
  )

  function handleBudgetChange(categoryId: string, euroValue: number, existingId?: string) {
    const amountCents = Math.round(euroValue * 100)
    if (amountCents <= 0) {
      if (existingId) deleteBudget(existingId)
      return
    }
    saveBudget({
      id: existingId ?? uid('budget'),
      categoryId,
      period: periodTab,
      amountCents,
    })
  }

  function applyTemplate(preset: 'frugal' | 'employed' | 'aggressive') {
    const targets: Record<string, number> = preset === 'frugal'
      ? { rent: 42000, grocer: 25000, transp: 4900, leisu: 6000 }
      : preset === 'employed'
        ? { rent: 85000, grocer: 35000, transp: 4900, din: 15000, person: 8000 }
        : { rent: 65000, grocer: 28000, transp: 4900, din: 8000, sip: 100000 }

    for (const [key, amountCents] of Object.entries(targets)) {
      const match = state.categories.find((c) => c.id.toLowerCase().includes(key) || c.name.toLowerCase().includes(key))
      if (match) {
        const existing = state.budgets.find((b) => b.categoryId === match.id && b.period === periodTab)
        saveBudget({
          id: existing?.id ?? uid('budget'),
          categoryId: match.id,
          period: periodTab,
          amountCents,
        })
      }
    }
  }

  const monthlyNetIncomeCents = useMemo(() => {
    const incTx = state.transactions.filter((t) => t.date.startsWith(month) && t.kind === 'income')
    const total = incTx.reduce((s, t) => s + t.amountCents, 0)
    return total > 0 ? total : 224000
  }, [state.transactions, month])

  const zeroBasedUnallocatedCents = monthlyNetIncomeCents - totalBudgetCents

  const sinkingFundItems = [
    { name: 'Semesterbeitrag (Uni & Student Union Fee)', cycle: 'Bi-annual (€200 / 6m)', monthlyCents: 3333 },
    { name: 'Rundfunkbeitrag (ARD / ZDF License Fee)', cycle: 'Quarterly (€55.08 / 3m)', monthlyCents: 1836 },
    { name: 'Haftpflichtversicherung (Personal Liability)', cycle: 'Annual (€60.00 / 12m)', monthlyCents: 500 },
  ]
  const totalSinkingMonthlyCents = sinkingFundItems.reduce((s, i) => s + i.monthlyCents, 0)

  return (
    <div className="stack" style={{ gap: 18 }}>
      <header className="page-head">
        <div>
          <h1>Budgets &amp; Spending Limits</h1>
          <p>
            Track actual spending against monthly and annual allocations, with 75%, 90%, and 100% threshold monitoring.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="pills">
            <button
              type="button"
              className={periodTab === 'month' ? 'on' : ''}
              onClick={() => setPeriodTab('month')}
            >
              Monthly Budgets ({month})
            </button>
            <button
              type="button"
              className={periodTab === 'year' ? 'on' : ''}
              onClick={() => setPeriodTab('year')}
            >
              Annual Budgets ({currentYear})
            </button>
          </div>

          <button
            type="button"
            className={`btn ghost ${envelopeRollover ? 'active tone-ok' : ''}`}
            style={{ fontSize: '0.8rem', padding: '4px 10px' }}
            onClick={() => setEnvelopeRollover((e) => !e)}
            title="Roll over unspent category surplus from previous month into current month's budget (Item 21)"
          >
            {envelopeRollover ? '✓ Rollover Envelopes ON' : 'Rollover Envelopes'}
          </button>
        </div>
      </header>

      {/* Preset Budget Profiles (Item 27) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Apply Budget Template:</span>
        <button type="button" className="btn ghost" style={{ fontSize: '0.78rem', padding: '3px 8px' }} onClick={() => applyTemplate('frugal')}>
          Student Frugal (€779/mo)
        </button>
        <button type="button" className="btn ghost" style={{ fontSize: '0.78rem', padding: '3px 8px' }} onClick={() => applyTemplate('employed')}>
          Full-Time Year 1 (€1,479/mo)
        </button>
        <button type="button" className="btn ghost" style={{ fontSize: '0.78rem', padding: '3px 8px' }} onClick={() => applyTemplate('aggressive')}>
          Aggressive Wealth Builder (€2,079/mo)
        </button>
      </div>

      {/* Zero-Based Budget Builder Summary (Item 24) */}
      <div style={{ padding: '12px 18px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--ok)', letterSpacing: '0.04em' }}>
            Zero-Based Budget Builder (Every Euro Has a Job)
          </span>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: 2 }}>
            {zeroBasedUnallocatedCents === 0 ? '€0.00 Remaining (Perfect Balance!)' : `${formatMoney(zeroBasedUnallocatedCents)} Unassigned`}
          </div>
          <span className="muted" style={{ fontSize: '0.75rem' }}>
            Net Income ({formatMoney(monthlyNetIncomeCents)}) &minus; Allocated Living Budgets ({formatMoney(totalBudgetCents)})
          </span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className="status-pill ok" style={zeroBasedUnallocatedCents < 0 ? { color: 'var(--danger)', borderColor: 'var(--danger)' } : {}}>
            {zeroBasedUnallocatedCents === 0 ? 'Zero-Based Balanced' : zeroBasedUnallocatedCents > 0 ? 'Buffer Available to Allocate' : 'Over-Allocated'}
          </span>
        </div>
      </div>

      {/* KPI Overview Cards with nasta-style KpiCard */}
      <section className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <KpiCard
          label={`Total ${periodTab === 'month' ? 'Monthly' : 'Annual'} Budget`}
          value={totalBudgetCents / 100}
          icon={Target}
          hint={`${rows.filter((r) => r.budget).length} categories budgeted`}
        />
        <KpiCard
          label="Total Spent"
          value={totalSpentCents / 100}
          icon={Receipt}
          hint={`Period: ${periodTab === 'month' ? month : currentYear}`}
        />
        <KpiCard
          label="Remaining Budget"
          value={totalRemainingCents / 100}
          icon={Wallet}
          tone={totalRemainingCents >= 0 ? 'positive' : 'negative'}
          badge={totalRemainingCents >= 0 ? 'Within limit' : 'Over budget'}
          hint={totalRemainingCents >= 0 ? 'Surplus buffer available' : 'Spending exceeded target'}
        />
        <KpiCard
          label="Overall Utilisation"
          value={totalUtilisation !== null ? totalUtilisation : 0}
          format={(n) => `${n.toFixed(1)}%`}
          icon={Percent}
          tone={totalUtilisation !== null && totalUtilisation > 100 ? 'negative' : totalUtilisation !== null && totalUtilisation >= 90 ? 'negative' : 'positive'}
          badge={totalUtilisation !== null && totalUtilisation > 100 ? '100% Exceeded' : undefined}
          hint={totalUtilisation !== null ? `${formatMoney(totalSpentCents)} spent of ${formatMoney(totalBudgetCents)}` : 'Set budgets to track'}
        />
      </section>

      {/* Spending Velocity & Burn Rate Card */}
      <SpendingVelocityCard
        currentSpendCents={totalSpentCents}
        monthlyBudgetCents={totalBudgetCents}
        daysElapsed={daysElapsed}
        totalDaysInMonth={totalDaysInMonth}
      />

      {/* Budgets Table */}
      <Panel
        title={`${periodTab === 'month' ? 'Monthly' : 'Annual'} Category Budgets`}
        extra={
          <Badge tone={totalRemainingCents < 0 ? 'bad' : 'ok'}>
            {periodTab === 'month' ? month : `Year ${currentYear}`}
          </Badge>
        }
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Type</th>
                <th className="num" style={{ width: 130 }}>Budget</th>
                <th className="num">Spent</th>
                <th className="num">Remaining</th>
                <th style={{ width: 170 }}>Utilisation &amp; Alerts</th>
                {periodTab === 'month' && <th className="num">Projected Month-End</th>}
                <th className="num">Prior Period</th>
                <th style={{ width: 60 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const util = row.budget && row.budget.amountCents > 0
                  ? (row.spent / row.budget.amountCents) * 100
                  : null
                const status = budgetStatus(util)
                const remaining = row.budget
                  ? row.budget.amountCents - row.spent
                  : null

                return (
                  <tr key={row.category.id}>
                    <td>
                      <div
                        style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        onClick={() => openCategoryDrilldown(row.category.id, row.category.name)}
                        title="Click to view category transactions"
                      >
                        <CategoryBadge category={row.category.id} label={row.category.name} />
                        <span className="muted" style={{ fontSize: '0.72rem' }}>&rarr;</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge">
                        {row.category.fixed ? 'Fixed' : 'Variable'}
                      </span>
                    </td>
                    <td className="num">
                      <EuroInput
                        value={(row.budget?.amountCents ?? 0) / 100}
                        placeholder="0.00"
                        className="budget-input"
                        onChange={(val) => handleBudgetChange(row.category.id, val, row.budget?.id)}
                      />
                    </td>
                    <td
                      className="num"
                      style={{ fontWeight: 600, cursor: 'pointer' }}
                      onClick={() => openCategoryDrilldown(row.category.id, row.category.name)}
                      title="Click to inspect spending records"
                    >
                      <span className="finora-link-cell" style={{ textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
                        {formatMoney(row.spent)}
                      </span>
                    </td>
                    <td className={`num ${remaining !== null && remaining < 0 ? 'tone-bad' : ''}`}>
                      {remaining !== null ? formatMoney(remaining) : '—'}
                    </td>
                    <td>
                      {row.budget && util !== null ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                            <span>{formatPercent(util)}</span>
                            <Badge tone={status === 'over' ? 'bad' : status === 'high' ? 'warn' : status === 'watch' ? 'warn' : 'ok'}>
                              {status === 'over' ? '100%+ Exceeded' : status === 'high' ? '90%+ Alert' : status === 'watch' ? '75%+ Watch' : 'On Track'}
                            </Badge>
                          </div>
                          <Progress value={util} />
                        </div>
                      ) : (
                        <span className="muted" style={{ fontSize: '0.8rem' }}>No budget set</span>
                      )}
                    </td>
                    {periodTab === 'month' && (
                      <td className="num muted">
                        {row.projected !== null ? formatMoney(row.projected) : '—'}
                      </td>
                    )}
                    <td className="num muted">{formatMoney(row.prior)}</td>
                    <td>
                      {row.budget ? (
                        <button
                          type="button"
                          className="btn ghost danger"
                          style={{ fontSize: '0.78rem', padding: '2px 6px' }}
                          onClick={() => deleteBudget(row.budget!.id)}
                        >
                          Clear
                        </button>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Actual vs Budget Comparison Chart & Fixed vs Variable Costs */}
      <div className="grid-2">
        <ChartChrome
          title="Actual Spending vs. Budget Allocation"
          hint="Direct comparison per budgeted category"
        >
          {rows.filter((r) => r.budget).length === 0 ? (
            <Empty title="No category budgets set" body="Enter budget figures in the table above to visualize actual vs. planned limits." />
          ) : (
            <div className="chart">
              <ResponsiveContainer>
                <BarChart
                  data={rows.filter((r) => r.budget).map((r) => ({
                    name: r.category.name,
                    budget: (r.budget?.amountCents ?? 0) / 100,
                    spent: r.spent / 100,
                  }))}
                >
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(value) => formatMoney(Math.round(Number(value) * 100))}
                  />
                  <Bar dataKey="budget" name="Budget" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="spent" name="Actual Spent" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartChrome>

        <Panel title="Fixed vs. Variable Cost Analysis">
          <div className="stack" style={{ gap: 14 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <strong>Fixed Obligations (Rent, Insurance, Utilities)</strong>
                <span>{formatMoney(costBreakdown.fixedSpent)}</span>
              </div>
              <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 6 }}>
                Budgeted: {formatMoney(costBreakdown.fixedBudget)} · {costBreakdown.fixedBudget > 0 ? `${formatPercent((costBreakdown.fixedSpent / costBreakdown.fixedBudget) * 100)} utilized` : 'No budget set'}
              </p>
              {costBreakdown.fixedBudget > 0 ? (
                <Progress value={(costBreakdown.fixedSpent / costBreakdown.fixedBudget) * 100} />
              ) : null}
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <strong>Variable Spending (Groceries, Dining, Personal)</strong>
                <span>{formatMoney(costBreakdown.variableSpent)}</span>
              </div>
              <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 6 }}>
                Budgeted: {formatMoney(costBreakdown.variableBudget)} · {costBreakdown.variableBudget > 0 ? `${formatPercent((costBreakdown.variableSpent / costBreakdown.variableBudget) * 100)} utilized` : 'No budget set'}
              </p>
              {costBreakdown.variableBudget > 0 ? (
                <Progress value={(costBreakdown.variableSpent / costBreakdown.variableBudget) * 100} />
              ) : null}
            </div>
          </div>
        </Panel>
      </div>

      {/* Annual Recurring Expense Sinking Fund Reserve (Item 29) */}
      <Panel title="Annual &amp; Quarterly Sinking Fund Reserve Calculator">
        <p className="muted" style={{ fontSize: '0.82rem', margin: '0 0 12px' }}>
          Smooth out irregular annual bills (Rundfunkbeitrag, semester fees, liability insurance) by reserving a fixed amount each month.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {sinkingFundItems.map((item) => (
            <div key={item.name} className="wealth-timeline-card">
              <span className="wealth-timeline-card__year">{item.name}</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--ok)', marginTop: 4 }}>
                {formatMoney(item.monthlyCents)} / mo
              </div>
              <span className="muted" style={{ fontSize: '0.72rem' }}>{item.cycle}</span>
            </div>
          ))}
          <div className="wealth-timeline-card" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <span className="wealth-timeline-card__year">Total Sinking Reserve</span>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>
              {formatMoney(totalSinkingMonthlyCents)} / mo
            </div>
            <span className="muted" style={{ fontSize: '0.72rem' }}>Recommended monthly automatic transfer</span>
          </div>
        </div>
      </Panel>

      {/* Spending Insights & Alerts */}
      {alerts.length > 0 ? (
        <Panel
          title="Unusual Increases & Spending Spikes"
          extra={<Badge tone="warn"><AlertTriangle size={12} style={{ marginRight: 4 }} />{alerts.length} Detected</Badge>}
        >
          <div className="list">
            {alerts.map((alert, idx) => (
              <div key={idx} className="row-card">
                <div>
                  <strong>{categoryName(state, alert.categoryId)}</strong>
                  <p className="muted" style={{ fontSize: '0.84rem' }}>
                    Spent {formatMoney(alert.currentCents)} in {alert.month} vs prior {formatMoney(alert.previousCents)} ({alert.previousMonth})
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="badge tone-bad">
                    +{formatPercent(((alert.currentCents - alert.previousCents) / alert.previousCents) * 100)}
                  </span>
                  <p className="muted" style={{ fontSize: '0.78rem', marginTop: 2 }}>
                    +{formatMoney(alert.currentCents - alert.previousCents)} spike
                  </p>
                </div>
              </div>
            ))}
          </div>
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
