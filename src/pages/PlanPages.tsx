import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, Empty, Field, Modal, Notice, Panel, Progress } from '../components/ui'
import { debtDisplayedBalance, debtWorkbookBalance, monthFigures, repaymentScenario } from '../lib/calc'
import { uid } from '../lib/createState'
import { daysInMonth, monthLabel, monthsBetween } from '../lib/dates'
import { formatMoney, parseAmount } from '../lib/money'
import { forecastFor } from '../lib/selectors'
import type { Debt, Goal } from '../lib/types'
import { useStore } from '../state/store'

type ScenarioIdFix = 'conservative' | 'expected' | 'optimistic'

export function SavingsPage() {
  const { state, saveGoal, deleteGoal } = useStore()
  const month = state.filters.month
  const figures = month === 'all' ? null : monthFigures(state.transactions, month, state.coverage.find((row) => row.month === month))
  const [open, setOpen] = useState(false)
  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <h1>Savings and goals</h1>
          <p>Actual savings are income minus expenses and debt payments. Transfers into savings are not expenses. Unknown balances stay unknown.</p>
        </div>
        <button type="button" className="btn primary" onClick={() => setOpen(true)}>Add goal</button>
      </header>
      <div className="grid-3">
        <Panel title="Actual savings"><strong>{formatMoney(figures?.savingsCents ?? null)}</strong><p className="muted">{month === 'all' ? 'Select one month.' : monthLabel(month)}</p></Panel>
        <Panel title="Savings rate"><strong>{figures?.savingsRate === null || figures?.savingsRate === undefined ? '—' : `${figures.savingsRate.toFixed(1)}%`}</strong><p className="muted">Undefined when income is zero or missing.</p></Panel>
        <Panel title="Planned transfers"><strong>{formatMoney(state.recurring.filter((rule) => rule.kind === 'savings_contribution').reduce((sum, rule) => sum + rule.amountCents, 0) || null)}</strong><p className="muted">Monthly gold and emergency amounts from the plan, not balances.</p></Panel>
      </div>
      <div className="grid-2">
        {state.goals.map((goal) => <GoalCard key={goal.id} goal={goal} onSave={saveGoal} onDelete={deleteGoal} />)}
      </div>
      {state.goals.length === 0 ? <Empty title="No goals yet" body="The workbook named investment plans but did not include target amounts or balances." /> : null}
      {open ? <GoalModal onClose={() => setOpen(false)} onSave={(goal) => { saveGoal(goal); setOpen(false) }} /> : null}
    </div>
  )
}

function GoalCard({ goal, onSave, onDelete }: { goal: Goal; onSave: (goal: Goal) => void; onDelete: (id: string) => void }) {
  const remaining = goal.targetCents !== null && goal.currentBalanceCents !== null ? goal.targetCents - goal.currentBalanceCents : null
  const progress = goal.targetCents && goal.currentBalanceCents !== null ? (goal.currentBalanceCents / goal.targetCents) * 100 : null
  const needed = monthlyNeeded(goal)
  return (
    <Panel title={goal.name} extra={<Badge tone={goal.currentBalanceCents === null ? 'warn' : 'ok'}>{goal.currentBalanceCents === null ? 'Balance unknown' : 'Balance entered'}</Badge>}>
      <div className="stack">
        <Progress value={progress} />
        <div className="row-card"><span>Target</span><input defaultValue={goal.targetCents !== null ? (goal.targetCents / 100).toFixed(2) : ''} placeholder="Unknown" onBlur={(event) => onSave({ ...goal, targetCents: event.target.value.trim() ? parseAmount(event.target.value) : null })} /></div>
        <div className="row-card"><span>Current balance</span><input defaultValue={goal.currentBalanceCents !== null ? (goal.currentBalanceCents / 100).toFixed(2) : ''} placeholder="Unknown" onBlur={(event) => onSave({ ...goal, currentBalanceCents: event.target.value.trim() ? parseAmount(event.target.value) : null })} /></div>
        <div className="row-card"><span>Deadline</span><input type="date" defaultValue={goal.deadline ?? ''} onBlur={(event) => onSave({ ...goal, deadline: event.target.value || null })} /></div>
        <p>Remaining: {remaining === null ? 'Unknown until both target and balance are entered' : formatMoney(remaining)}</p>
        <p>Monthly amount to finish on time: {needed}</p>
        <p className="muted">{goal.notes}{goal.contributionEstimated && goal.monthlyContributionCents !== null ? ` Planned contribution in the workbook: ${formatMoney(goal.monthlyContributionCents)} (estimate).` : ''}</p>
        {goal.source === 'manual' ? <button type="button" className="btn ghost danger" onClick={() => onDelete(goal.id)}>Delete goal</button> : null}
      </div>
    </Panel>
  )
}

function monthlyNeeded(goal: Goal): string {
  if (goal.targetCents === null || goal.currentBalanceCents === null || !goal.deadline) return 'Enter a target, a current balance, and a deadline.'
  const today = new Date().toISOString().slice(0, 7)
  const months = monthsBetween(today, goal.deadline.slice(0, 7)).length
  if (months <= 0) return 'The deadline is not in the future.'
  const remaining = goal.targetCents - goal.currentBalanceCents
  if (remaining <= 0) return 'The entered balance already meets the target.'
  return `${formatMoney(Math.ceil(remaining / months))} for ${months} months`
}

function GoalModal({ onClose, onSave }: { onClose: () => void; onSave: (goal: Goal) => void }) {
  return (
    <Modal title="Add goal" onClose={onClose}>
      <form className="form-grid" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const name = String(form.get('name') ?? '').trim()
        if (!name) return
        onSave({
          id: uid('goal'),
          name,
          targetCents: parseAmount(String(form.get('target') ?? '')) ,
          deadline: String(form.get('deadline') ?? '') || null,
          currentBalanceCents: parseAmount(String(form.get('balance') ?? '')),
          monthlyContributionCents: parseAmount(String(form.get('contribution') ?? '')),
          contributionEstimated: false,
          source: 'manual',
          notes: 'Added in the dashboard.',
        })
      }}>
        <Field label="Name"><input name="name" required /></Field>
        <Field label="Target"><input name="target" placeholder="Leave blank if unknown" /></Field>
        <Field label="Current balance"><input name="balance" placeholder="Leave blank if unknown" /></Field>
        <Field label="Deadline"><input name="deadline" type="date" /></Field>
        <Field label="Planned monthly contribution"><input name="contribution" /></Field>
        <div className="wide"><button className="btn primary" type="submit">Save goal</button></div>
      </form>
    </Modal>
  )
}

export function DebtsPage() {
  const { state, saveDebt, deleteDebt } = useStore()
  const [method, setMethod] = useState<'avalanche' | 'snowball'>('avalanche')
  const [extra, setExtra] = useState('0')
  const scenario = repaymentScenario(state.debts, method, parseAmount(extra) ?? 0, new Date().toISOString().slice(0, 7))
  const [open, setOpen] = useState(false)
  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <h1>Debts</h1>
          <p>Original items, payments already listed, and the current balance are kept separate. A workbook formula is not a statement balance.</p>
        </div>
        <button type="button" className="btn primary" onClick={() => setOpen(true)}>Add debt</button>
      </header>
      {state.debts.map((debt) => <DebtCard key={debt.id} debt={debt} onSave={saveDebt} onDelete={deleteDebt} />)}
      <Panel title="Repayment scenarios">
        <div className="filters">
          <select value={method} onChange={(event) => setMethod(event.target.value as 'avalanche' | 'snowball')}>
            <option value="avalanche">Avalanche — highest interest first</option>
            <option value="snowball">Snowball — smallest balance first</option>
          </select>
          <input value={extra} onChange={(event) => setExtra(event.target.value)} aria-label="Extra monthly payment" placeholder="Extra payment EUR" />
        </div>
        {scenario.ok ? <p>Estimated debt-free date {scenario.debtFreeMonth ?? 'now'}, {scenario.months} months, interest {formatMoney(scenario.interestCents ?? 0)}. Order: {scenario.order?.join(', ') || 'none'}.</p> : <Notice tone="warn">{scenario.reason}</Notice>}
        <p className="muted">Assumptions: fixed annual rates, no fees, minimums are paid every month, and the extra payment goes to one debt at a time. This is a projection, not a guarantee.</p>
      </Panel>
      {open ? <DebtModal onClose={() => setOpen(false)} onSave={(debt) => { saveDebt(debt); setOpen(false) }} /> : null}
    </div>
  )
}

function DebtCard({ debt, onSave, onDelete }: { debt: Debt; onSave: (debt: Debt) => void; onDelete: (id: string) => void }) {
  const displayed = debtDisplayedBalance(debt)
  const workbook = debtWorkbookBalance(debt)
  const paid = debt.payments.reduce((sum, payment) => sum + payment.amountCents, 0)
  return (
    <Panel title={debt.name} extra={<Badge tone={displayed.confirmed ? 'ok' : 'warn'}>{displayed.confirmed ? 'Confirmed balance' : 'Unconfirmed workbook balance'}</Badge>}>
      <div className="grid-3">
        <div><p className="muted">Original items</p><strong>{formatMoney(debt.components.reduce((sum, item) => sum + item.amountCents, 0))}</strong></div>
        <div><p className="muted">Payments listed</p><strong>{formatMoney(paid)}</strong></div>
        <div><p className="muted">Balance used</p><strong>{formatMoney(displayed.cents)}</strong></div>
      </div>
      <p className="muted">Workbook calculation: {formatMoney(workbook)}. {debt.notes}</p>
      <ul>{debt.components.map((item) => <li key={item.id}>{item.name}: {formatMoney(item.amountCents)}</li>)}</ul>
      <div className="form-grid">
        <Field label="Confirmed balance (blank = unknown)"><input defaultValue={debt.confirmedBalanceCents !== null ? (debt.confirmedBalanceCents / 100).toFixed(2) : ''} onBlur={(event) => onSave({ ...debt, confirmedBalanceCents: event.target.value.trim() ? parseAmount(event.target.value) : null })} /></Field>
        <Field label="Interest rate % (blank = unknown)"><input defaultValue={debt.interestRateAnnual ?? ''} onBlur={(event) => { const raw = event.target.value.trim(); const value = Number(raw); onSave({ ...debt, interestRateAnnual: raw && Number.isFinite(value) ? value : null }) }} /></Field>
        <Field label="Minimum payment"><input defaultValue={debt.minimumPaymentCents !== null ? (debt.minimumPaymentCents / 100).toFixed(2) : ''} onBlur={(event) => onSave({ ...debt, minimumPaymentCents: event.target.value.trim() ? parseAmount(event.target.value) : null })} /></Field>
        <Field label="Due day"><input type="number" min={1} max={28} defaultValue={debt.dueDay ?? ''} onBlur={(event) => onSave({ ...debt, dueDay: event.target.value ? Number(event.target.value) : null })} /></Field>
      </div>
      <form className="filters" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const amount = parseAmount(String(form.get('amount') ?? ''))
        const interest = parseAmount(String(form.get('interest') ?? '')) ?? 0
        const date = String(form.get('date') ?? '')
        if (amount === null || amount <= 0 || interest < 0 || interest > amount) return
        const principal = amount - interest
        onSave({
          ...debt,
          confirmedBalanceCents: debt.confirmedBalanceCents === null ? null : Math.max(0, debt.confirmedBalanceCents - principal),
          payments: [...debt.payments, { id: uid('pay'), amountCents: amount, principalCents: principal, interestCents: interest, date: date || null, note: 'Entered in the dashboard. Principal is the payment minus the interest you entered.' }],
        })
        event.currentTarget.reset()
      }}>
        <input name="date" type="date" aria-label="Payment date" />
        <input name="amount" placeholder="Payment" aria-label="Payment amount" />
        <input name="interest" placeholder="Interest portion" aria-label="Interest portion" />
        <button className="btn" type="submit">Record payment</button>
      </form>
      {debt.source === 'manual' ? <button type="button" className="btn ghost danger" onClick={() => onDelete(debt.id)}>Delete debt</button> : null}
    </Panel>
  )
}

function DebtModal({ onClose, onSave }: { onClose: () => void; onSave: (debt: Debt) => void }) {
  return (
    <Modal title="Add debt" onClose={onClose}>
      <form className="form-grid" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const name = String(form.get('name') ?? '').trim()
        const original = parseAmount(String(form.get('original') ?? ''))
        if (!name || original === null || original <= 0) return
        onSave({
          id: uid('debt'),
          name,
          components: [{ id: uid('part'), name: 'Original amount', amountCents: original }],
          payments: [],
          interestRateAnnual: form.get('rate') ? Number(form.get('rate')) : null,
          minimumPaymentCents: parseAmount(String(form.get('minimum') ?? '')),
          confirmedBalanceCents: parseAmount(String(form.get('balance') ?? '')),
          dueDay: form.get('due') ? Number(form.get('due')) : null,
          source: 'manual',
          notes: 'Added in the dashboard.',
        })
      }}>
        <Field label="Name"><input name="name" required /></Field>
        <Field label="Original amount"><input name="original" required /></Field>
        <Field label="Confirmed current balance"><input name="balance" placeholder="Unknown" /></Field>
        <Field label="Interest %"><input name="rate" /></Field>
        <Field label="Minimum payment"><input name="minimum" /></Field>
        <Field label="Due day"><input name="due" type="number" min={1} max={28} /></Field>
        <div className="wide"><button className="btn primary" type="submit">Save debt</button></div>
      </form>
    </Modal>
  )
}

export function CalendarPage() {
  const { state, saveBill } = useStore()
  const month = state.filters.month === 'all' ? new Date().toISOString().slice(0, 7) : state.filters.month
  const [year, mon] = month.split('-').map(Number)
  const first = new Date(Date.UTC(year, mon - 1, 1)).getUTCDay()
  const count = daysInMonth(month)
  const cells = [...Array(first).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)]
  const recorded = state.transactions.filter((transaction) => transaction.date.startsWith(month) && transaction.origin === 'actual')
  const unknown = recorded.filter((transaction) => !transaction.dayKnown)
  const planned = state.bills.filter((bill) => bill.active)
  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <h1>Calendar</h1>
          <p>{monthLabel(month)}. Recorded payments and scheduled plans are labelled differently. Most workbook rows do not have a due day.</p>
        </div>
      </header>
      <Panel title="Due day not recorded">
        {unknown.length === 0 && planned.every((bill) => bill.dueDay) ? <p className="muted">Nothing is waiting for a due day.</p> : (
          <div className="list">
            {unknown.slice(0, 8).map((transaction) => <div key={transaction.id} className="row-card"><span>{transaction.description}</span><Badge>Recorded · day unknown · {formatMoney(transaction.amountCents)}</Badge></div>)}
            {unknown.length > 8 ? <p className="muted">{unknown.length - 8} more recorded items have no day.</p> : null}
            {planned.filter((bill) => !bill.dueDay).map((bill) => <div key={bill.id} className="row-card"><span>{bill.name}</span><Badge tone="warn">Planned · due day not set · {formatMoney(bill.amountCents)}</Badge></div>)}
          </div>
        )}
      </Panel>
      <div className="calendar">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day} className="dow">{day}</div>)}
        {cells.map((day, index) => (
          <div key={index} className="day">
            {day ? <strong>{day}</strong> : null}
            {day ? recorded.filter((transaction) => transaction.dayKnown && Number(transaction.date.slice(8, 10)) === day).map((transaction) => <span key={transaction.id} className="pill">{transaction.description}</span>) : null}
            {day ? planned.filter((bill) => bill.dueDay === day).map((bill) => <span key={bill.id} className="pill plan">Plan · {bill.name}</span>) : null}
          </div>
        ))}
      </div>
      <Panel title="Bills">
        {state.bills.length === 0 ? <Empty title="No bills" body="Bills detected from history are inactive until you turn them on." /> : state.bills.map((bill) => (
          <div className="row-card" key={bill.id}>
            <div>
              <strong>{bill.name}</strong>
              <div className="muted">{bill.note}</div>
            </div>
            <div className="actions">
              <input aria-label={`${bill.name} due day`} type="number" min={1} max={28} defaultValue={bill.dueDay ?? ''} placeholder="Day" onBlur={(event) => saveBill({ ...bill, dueDay: event.target.value ? Number(event.target.value) : null })} />
              <select defaultValue={bill.interval} aria-label={`${bill.name} interval`} onChange={(event) => saveBill({ ...bill, interval: event.target.value as 'monthly' | 'quarterly' | 'yearly' })}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
              <button type="button" className="btn" onClick={() => saveBill({ ...bill, active: !bill.active })}>{bill.active ? 'Active' : 'Off'}</button>
            </div>
          </div>
        ))}
      </Panel>
    </div>
  )
}

export function ForecastPage() {
  const { state, update } = useStore()
  const [count, setCount] = useState<6 | 12>(6)
  const [scenario, setScenario] = useState<ScenarioIdFix>('expected')
  const model = forecastFor(state, count, scenario)
  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <h1>Forecast</h1>
          <p>The next {count} months after the selected period. Figures are scenarios, not promises.</p>
        </div>
        <div className="actions">
          <button type="button" className={`btn ${count === 6 ? 'primary' : ''}`} onClick={() => setCount(6)}>6 months</button>
          <button type="button" className={`btn ${count === 12 ? 'primary' : ''}`} onClick={() => setCount(12)}>12 months</button>
        </div>
      </header>
      <div className="actions">
        {(['conservative', 'expected', 'optimistic'] as ScenarioIdFix[]).map((id) => <button type="button" key={id} className={`btn ${scenario === id ? 'primary' : ''}`} onClick={() => setScenario(id)}>{id[0].toUpperCase() + id.slice(1)}</button>)}
      </div>
      <Notice>{model.scenario.summary}</Notice>
      <Panel title="Projected cash flow">
        <div className="chart">
          <ResponsiveContainer>
            <LineChart data={model.months.map((month) => ({ label: month.month.slice(2), income: month.incomeCents === null ? null : month.incomeCents / 100, expense: month.expenseCents === null ? null : month.expenseCents / 100, cash: month.cashFlowCents === null ? null : month.cashFlowCents / 100 }))}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <Tooltip formatter={(value) => formatMoney(Math.round(Number(value) * 100))} />
              <Line dataKey="income" name="Income" stroke="#1d4e89" dot={false} />
              <Line dataKey="expense" name="Spending" stroke="#b45309" dot={false} />
              <Line dataKey="cash" name="Cash left" stroke="#0f7b4c" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Month</th><th className="num">Income</th><th className="num">Spending</th><th className="num">Savings transfers</th><th className="num">Debt payment</th><th className="num">Cash left</th><th>Source</th></tr></thead>
            <tbody>
              {model.months.map((month) => (
                <tr key={month.month}>
                  <td>{monthLabel(month.month)}{month.limited ? ' · limited' : ''}</td>
                  <td className="num">{formatMoney(month.incomeCents)}</td>
                  <td className="num">{formatMoney(month.expenseCents)}</td>
                  <td className="num">{formatMoney(month.savingsTransferCents)}</td>
                  <td className="num">{formatMoney(month.debtPaymentCents)}</td>
                  <td className="num">{formatMoney(month.cashFlowCents)}</td>
                  <td className="muted">{month.incomeSource}. {month.expenseSource}. {month.notes.join(' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Assumptions you can edit">
        <div className="form-grid">
          <Field label="Manual monthly income for unplanned months"><input defaultValue={state.assumptions.manualRunRateIncomeCents !== null ? (state.assumptions.manualRunRateIncomeCents / 100).toFixed(2) : ''} placeholder="Use recent average" onBlur={(event) => update((current) => ({ ...current, assumptions: { ...current.assumptions, manualRunRateIncomeCents: event.target.value.trim() ? parseAmount(event.target.value) : null } }))} /></Field>
          <Field label="Manual monthly spending for unplanned months"><input defaultValue={state.assumptions.manualRunRateExpenseCents !== null ? (state.assumptions.manualRunRateExpenseCents / 100).toFixed(2) : ''} placeholder="Use recent average" onBlur={(event) => update((current) => ({ ...current, assumptions: { ...current.assumptions, manualRunRateExpenseCents: event.target.value.trim() ? parseAmount(event.target.value) : null } }))} /></Field>
        </div>
        <ul>{model.assumptions.map((note) => <li key={note}>{note}</li>)}{state.assumptions.horizonNotes.map((note) => <li key={note}>{note}</li>)}</ul>
      </Panel>
    </div>
  )
}
