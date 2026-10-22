import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, Field, Notice, Panel, Stat } from '../components/ui'
import { activeChapter, scopeState } from '../lib/chapter'
import { monthLabel } from '../lib/dates'
import { estimatePayslip } from '../lib/forecast'
import { formatMoney, formatPercent } from '../lib/money'
import { monthFigures } from '../lib/calc'
import { categoryName, trend } from '../lib/selectors'
import type { DeductionRates } from '../lib/types'
import { useStore } from '../state/store'

export function IncomePage() {
  const { state: full, update } = useStore()
  const state = scopeState(full)
  const employed = activeChapter(state) === 'employed'
  const months = [...new Set(state.transactions.filter((transaction) => transaction.kind === 'income' && transaction.origin === 'actual').map((transaction) => transaction.date.slice(0, 7)))].sort()
  const history = trend(state, state.filters.month)
  const plan = state.incomePlans[0]
  const payslip = plan ? estimatePayslip(plan.grossMonthlyCents, state.assumptions.rates) : null
  const selected = state.filters.month === 'all' ? null : monthFigures(state.transactions, state.filters.month, state.coverage.find((row) => row.month === state.filters.month))

  function setRate(key: keyof DeductionRates, raw: string) {
    const percent = Number(raw)
    if (!Number.isFinite(percent) || percent < 0 || percent > 80) return
    update((current) => ({ ...current, assumptions: { ...current.assumptions, rates: { ...current.assumptions.rates, [key]: percent / 100 } } }))
  }

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <h1>{employed ? 'Full-time income' : 'Student income'}</h1>
          <p>{employed ? 'Estimated salary from the full-time plan. Student earnings are not included, and these percentages are not a payslip.' : 'Recorded student earnings and money received. The full-time salary plan is not included.'}</p>
        </div>
      </header>
      <section className="stat-grid">
        <Stat label="Actual income in view" value={formatMoney(selected?.incomeCents ?? null)} detail={selected ? monthLabel(state.filters.month) : 'Choose one month to see that period'} />
        <Stat label={employed ? 'Plan gross' : 'Student gross'} value={employed && plan ? formatMoney(plan.grossMonthlyCents) : '—'} detail={employed && plan ? `${plan.employer}, ${plan.startMonth} to ${plan.endMonth}` : 'Salary formulas stay in Full-time'} />
        <Stat label="Estimated net" value={employed && payslip ? formatMoney(payslip.netCents) : '—'} detail={employed && payslip?.deductionPercent !== null && payslip ? `${formatPercent(payslip.deductionPercent)} estimated deductions` : 'Not a payslip'} />
        <Stat label="Estimated deductions" value={employed && payslip ? formatMoney(payslip.deductionCents) : '—'} detail={employed ? 'Each line is rounded to the cent' : 'Not part of student life'} />
      </section>
      <div className="grid-2">
        <Panel title="Actual monthly income" extra={<Badge>History</Badge>}>
          <div className="chart">
            <ResponsiveContainer>
              <LineChart data={history}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                <Tooltip formatter={(value) => formatMoney(Math.round(Number(value) * 100))} />
                <Line type="monotone" dataKey="income" name="Income" stroke="#1d4e89" strokeWidth={2} dot={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        {employed ? <Panel title="Estimated payslip" extra={<Badge tone="warn">Estimate</Badge>}>
          {!payslip || !plan ? <p>No salary plan was imported.</p> : (
            <div className="stack">
              <Notice>These percentages come from formulas in the workbook. They are not verified payroll calculations. Editing them changes the forecast, not the historical income.</Notice>
              {payslip.lines.map((line) => (
                <div className="row-card" key={line.key}>
                  <span>{line.label}</span>
                  <strong>{formatMoney(line.cents)}</strong>
                </div>
              ))}
              <div className="form-grid">
                <RateField label="Income tax %" value={state.assumptions.rates.incomeTax} onChange={(value) => setRate('incomeTax', value)} />
                <RateField label="Pension %" value={state.assumptions.rates.pension} onChange={(value) => setRate('pension', value)} />
                <RateField label="Unemployment %" value={state.assumptions.rates.unemployment} onChange={(value) => setRate('unemployment', value)} />
                <RateField label="Health %" value={state.assumptions.rates.health} onChange={(value) => setRate('health', value)} />
                <RateField label="Long-term care %" value={state.assumptions.rates.longTermCare} onChange={(value) => setRate('longTermCare', value)} />
              </div>
              <label className="check">
                <input type="checkbox" checked={state.settings.assumptionsLocked} onChange={(event) => update((current) => ({ ...current, settings: { ...current.settings, assumptionsLocked: event.target.checked } }))} />
                Keep these rates when I upload a new workbook
              </label>
            </div>
          )}
        </Panel> : <Panel title="Student income only"><p>The gross salary, tax, pension, and insurance formulas belong to the full-time plan. Switch to Full-time to see them.</p></Panel>}
      </div>
      {employed ? null : <Panel title="Recorded sources">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Month</th><th>Source</th><th className="num">Amount</th><th>Workplace note</th></tr></thead>
            <tbody>
              {months.flatMap((month) => state.transactions.filter((transaction) => transaction.kind === 'income' && transaction.origin === 'actual' && transaction.date.startsWith(month)).map((transaction) => (
                <tr key={transaction.id}>
                  <td>{monthLabel(month)}</td>
                  <td>{categoryName(state, transaction.categoryId)}</td>
                  <td className="num">{formatMoney(transaction.amountCents)}</td>
                  <td className="muted">{transaction.notes}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </Panel>}
      {state.assumptions.accounts.length ? (
        <Panel title="Account labels from the workbook">
          {state.assumptions.accounts.map((account) => <div className="row-card" key={`${account.role}-${account.name}`}><span>{account.role}</span><strong>{account.name}</strong></div>)}
          <p className="muted">These are names only. No account numbers were imported, and none of these are confirmed balances.</p>
        </Panel>
      ) : null}
    </div>
  )
}

function RateField({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {
  return <Field label={label}><input defaultValue={(value * 100).toFixed(2)} onBlur={(event) => onChange(event.target.value)} /></Field>
}
