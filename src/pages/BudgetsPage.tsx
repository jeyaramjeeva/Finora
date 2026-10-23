import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Target, Receipt, Wallet, Percent, AlertTriangle } from 'lucide-react'
import { Badge, Empty, Panel, Progress } from '../components/ui'
import { KpiCard } from '../components/KpiCard'
import { ChartChrome, chartTooltipStyle } from '../components/ChartChrome'
import { EuroInput } from '../components/EuroInput'
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
  const month = state.filters.month === 'all' ? (state.stats?.actualEnd?.slice(0, 7) ?? '2026-02') : state.filters.month
  const currentYear = Number(month.slice(0, 4))
  const previousMonth = month ? addMonths(month, -1) : ''
  const previousYear = currentYear - 1

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

        const projected = periodTab === 'month'
          ? projectMonthEnd(spent, month, new Date())
          : null

        return { category, budget, applied, spent, prior, projected }
      })
      .filter(
        (row) =>
          row.budget ||
          row.spent > 0 ||
          state.transactions.some(
            (t) => t.categoryId === row.category.id && t.kind === 'expense'
          )
      )
  }, [state.categories, state.budgets, state.transactions, periodTab, month, currentYear, previousMonth, previousYear])

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

  return (
    <div className="stack" style={{ gap: 18 }}>
      <header className="page-head">
        <div>
          <h1>Budgets &amp; Spending Limits</h1>
          <p>
            Track actual spending against monthly and annual allocations, with 75%, 90%, and 100% threshold monitoring.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
        </div>
      </header>

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
                      <strong>{row.category.name}</strong>
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
                    <td className="num" style={{ fontWeight: 600 }}>{formatMoney(row.spent)}</td>
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
    </div>
  )
}
