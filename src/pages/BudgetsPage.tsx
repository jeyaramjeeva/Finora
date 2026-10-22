import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, Empty, Panel, Progress } from '../components/ui'
import { applyBudget, budgetStatus, eligibleSpend } from '../lib/calc'
import { addMonths } from '../lib/dates'
import { formatMoney, formatPercent, parseAmount } from '../lib/money'
import { categoryName } from '../lib/selectors'
import { uid } from '../lib/createState'
import { scopeState } from '../lib/chapter'
import { useStore } from '../state/store'

export function BudgetsPage() {
  const { state: full, saveBudget, deleteBudget } = useStore()
  const state = scopeState(full)
  const month = state.filters.month === 'all' ? (state.stats?.actualEnd?.slice(0, 7) ?? '') : state.filters.month
  const previous = month ? addMonths(month, -1) : ''
  const rows = state.categories.filter((category) => category.active && category.kind === 'expense').map((category) => {
    const budget = state.budgets.find((item) => item.categoryId === category.id && item.period === 'month')
    const annual = state.budgets.find((item) => item.categoryId === category.id && item.period === 'year')
    const applied = budget && month ? applyBudget(budget, state.transactions, month) : null
    const prior = month ? eligibleSpend(state.transactions, category.id, { month: previous }) : 0
    return { category, budget, annual, applied, prior }
  }).filter((row) => row.budget || row.applied || state.transactions.some((transaction) => transaction.categoryId === row.category.id && transaction.kind === 'expense'))

  function setMonthly(categoryId: string, raw: string, existingId?: string) {
    const amount = parseAmount(raw)
    if (amount === null || amount <= 0) return
    saveBudget({ id: existingId ?? uid('budget'), categoryId, period: 'month', amountCents: amount })
  }

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <h1>Budgets</h1>
          <p>{month ? `Spending compared with ${month}.` : 'Choose a month.'} Alerts start at 75%, 90%, and 100%.</p>
        </div>
      </header>
      {!month ? <Empty title="No month selected" body="Pick a month in the top bar." /> : (
        <Panel title="Monthly budgets">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Category</th><th className="num">Budget</th><th className="num">Spent</th><th className="num">Left</th><th>Used</th><th className="num">Previous</th><th></th></tr></thead>
              <tbody>
                {rows.map((row) => {
                  const status = budgetStatus(row.applied?.utilisation ?? null)
                  return (
                    <tr key={row.category.id}>
                      <td>{row.category.name}{row.category.fixed ? <div className="muted">Fixed</div> : null}</td>
                      <td className="num"><input aria-label={`${row.category.name} budget`} defaultValue={row.budget ? (row.budget.amountCents / 100).toFixed(2) : ''} placeholder="Set" onBlur={(event) => setMonthly(row.category.id, event.target.value, row.budget?.id)} /></td>
                      <td className="num">{formatMoney(row.applied?.spentCents ?? eligibleSpend(state.transactions, row.category.id, { month }))}</td>
                      <td className="num">{row.applied ? formatMoney(row.applied.remainingCents) : '—'}</td>
                      <td>{row.applied ? <><Progress value={row.applied.utilisation} /> <Badge tone={status === 'over' || status === 'high' ? 'bad' : status === 'watch' ? 'warn' : 'ok'}>{formatPercent(row.applied.utilisation)}</Badge></> : 'No budget'}</td>
                      <td className="num">{formatMoney(row.prior)}</td>
                      <td>{row.budget ? <button type="button" className="btn ghost" onClick={() => deleteBudget(row.budget!.id)}>Clear</button> : null}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      <Panel title="Actual versus budget">
        {state.budgets.length === 0 ? <Empty title="No budgets yet" body="Enter a monthly amount beside a category. The workbook did not contain a budget column." /> : (
          <div className="chart">
            <ResponsiveContainer>
              <BarChart data={state.budgets.filter((budget) => budget.period === 'month').map((budget) => ({
                name: categoryName(state, budget.categoryId),
                budget: budget.amountCents / 100,
                spent: (month ? eligibleSpend(state.transactions, budget.categoryId, { month }) : 0) / 100,
              }))}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} interval={0} angle={-25} height={70} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                <Tooltip formatter={(value) => formatMoney(Math.round(Number(value) * 100))} />
                <Bar dataKey="budget" name="Budget" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                <Bar dataKey="spent" name="Spent" fill="#0f7b4c" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>
    </div>
  )
}
