import { useMemo, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  TrendingUp,
  Percent,
  ShieldCheck,
  Target,
  Landmark,
  Receipt,
  Banknote,
  LineChart as LineChartIcon,
  CalendarClock,
  PlusCircle,
} from 'lucide-react'
import { Badge, Empty, Field, Modal, Notice, Panel, Progress } from '../components/ui'
import { KpiCard } from '../components/KpiCard'
import { ChartChrome, chartTooltipStyle } from '../components/ChartChrome'
import { WealthPortfolioTracker } from '../components/WealthPortfolioTracker'
import { DebtPayoffSimulator } from '../components/DebtPayoffSimulator'
import { SubscriptionDetector } from '../components/SubscriptionDetector'
import { activeChapter, planSnapshot, scopeState } from '../lib/chapter'
import { debtDisplayedBalance, debtWorkbookBalance, monthFigures, outstandingDebt, repaymentScenario } from '../lib/calc'
import { uid } from '../lib/createState'
import { daysInMonth, monthLabel, monthsBetween } from '../lib/dates'
import { formatMoney, parseAmount } from '../lib/money'
import { forecastFor } from '../lib/selectors'
import type { Debt, Goal } from '../lib/types'
import { useStore } from '../state/store'

type ScenarioIdFix = 'conservative' | 'expected' | 'optimistic'

export function SavingsPage() {
  const { state: full, saveGoal, deleteGoal } = useStore()
  const state = scopeState(full)
  const month = state.filters.month
  const employed = activeChapter(state) === 'employed'
  const figures = month === 'all' ? null : employed ? planSnapshot(state, month) : monthFigures(state.transactions, month, state.coverage.find((row) => row.month === month))
  const [open, setOpen] = useState(false)

  // Workbook investment plan reference data from Full Time Yearly sheet
  const workbookInvestments = [
    { name: 'SIP (Germany ETF)', invested: 5540000, period: 'Till Mar-2050', minVal: 17867054, maxVal: 43827401, account: 'Trade Republic / Scalable' },
    { name: 'Indian SIP', invested: 500000, period: 'Till Mar-2029', minVal: 562432, maxVal: 612522, account: 'Union Bank of India (UBI)' },
    { name: 'Gold Investment', invested: 270000, period: 'Till Mar-2029', minVal: 286526, maxVal: 340122, account: 'Physical / Vault' },
    { name: 'Emergency Fund', invested: 270000, period: 'Till Mar-2029', minVal: 270000, maxVal: 270000, account: 'Scalable Capital' },
  ]

  const totalMonthlyPlanContribution = state.recurring
    .filter((rule) => rule.kind === 'savings_contribution')
    .reduce((sum, rule) => sum + rule.amountCents, 0)

  return (
    <div className="stack" style={{ gap: 18 }}>
      <header className="page-head">
        <div>
          <h1>Savings Planner &amp; Financial Goals</h1>
          <p>
            {employed
              ? 'Long-term investment targets, ETF compounding models, and recurring monthly contributions from your full-time plan.'
              : 'Student savings calculated as net income minus actual living expenses. Movements into savings accounts are tracked as transfers.'}
          </p>
        </div>
        <button type="button" className="btn primary" onClick={() => setOpen(true)}>
          <PlusCircle size={16} /> Add New Goal
        </button>
      </header>

      {/* Summary KPI Cards with nasta-style KpiCard */}
      <section className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <KpiCard
          label="Actual Savings in View"
          value={(figures?.savingsCents ?? 0) / 100}
          icon={TrendingUp}
          tone={(figures?.savingsCents ?? 0) >= 0 ? 'positive' : 'negative'}
          badge={(figures?.savingsCents ?? 0) >= 0 ? 'Surplus' : 'Deficit'}
          hint={month === 'all' ? 'Select a single month' : monthLabel(month)}
        />
        <KpiCard
          label="Savings Rate"
          value={figures?.savingsRate !== null && figures?.savingsRate !== undefined ? figures.savingsRate : 0}
          format={(n) => `${n.toFixed(1)}%`}
          icon={Percent}
          tone={figures?.savingsRate !== null && figures?.savingsRate !== undefined && figures.savingsRate >= 20 ? 'positive' : 'neutral'}
          hint="Savings divided by net income"
        />
        <KpiCard
          label="Planned Monthly Savings"
          value={(totalMonthlyPlanContribution || (employed ? 60000 : 0)) / 100}
          icon={ShieldCheck}
          tone="positive"
          hint="ETF, Indian SIP, Gold, Emergency Fund"
        />
        <KpiCard
          label="Active Goals Tracked"
          value={state.goals.length}
          format={(n) => `${Math.round(n)} targets`}
          icon={Target}
          hint="Editable deadlines &amp; contributions"
        />
      </section>

      {/* Investment Plans from Workbook */}
      <Panel title="Workbook Investment Horizons &amp; Compound Forecasts">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {workbookInvestments.map((inv) => (
            <div className="brief-card" key={inv.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.95rem' }}>{inv.name}</strong>
                <Badge tone="ok">{inv.period}</Badge>
              </div>
              <div className="muted" style={{ fontSize: '0.78rem' }}>Target Invested: {formatMoney(inv.invested)}</div>
              <div style={{ marginTop: 4 }}>
                <span className="muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Projected Horizon Value:</span>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--green)' }}>
                  {formatMoney(inv.minVal)} – {formatMoney(inv.maxVal)}
                </div>
              </div>
              <div className="muted" style={{ fontSize: '0.75rem', marginTop: 2 }}>Account: {inv.account}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Multi-Bucket Wealth, Compounding & Gold Portfolio Tracker */}
      <WealthPortfolioTracker />

      {/* Financial Goals Grid */}
      <Panel title="Configured Savings Goals &amp; Progress">
        {state.goals.length === 0 ? (
          <Empty title="No savings goals" body="Click '+ Add New Goal' to configure your emergency fund, car, or trip goals." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {state.goals.map((goal) => {
              const pct = goal.targetCents && goal.currentBalanceCents !== null ? Math.min(100, Math.round((goal.currentBalanceCents / goal.targetCents) * 100)) : null
              return (
                <div key={goal.id} className="brief-card" style={{ padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <strong style={{ fontSize: '1rem' }}>{goal.name}</strong>
                    <button
                      type="button"
                      className="btn ghost danger"
                      style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                      onClick={() => deleteGoal(goal.id)}
                    >
                      Delete
                    </button>
                  </div>

                  <div className="split" style={{ fontSize: '0.88rem', margin: '4px 0' }}>
                    <span className="muted">Target:</span>
                    <strong>{formatMoney(goal.targetCents)}</strong>
                  </div>

                  <div className="split" style={{ fontSize: '0.88rem', margin: '4px 0' }}>
                    <span className="muted">Confirmed Balance:</span>
                    <strong style={{ color: goal.currentBalanceCents !== null ? 'var(--green)' : 'var(--muted)' }}>
                      {goal.currentBalanceCents !== null ? formatMoney(goal.currentBalanceCents) : 'Unknown (Not yet linked)'}
                    </strong>
                  </div>

                  {pct !== null ? (
                    <div style={{ margin: '8px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                        <span className="muted">Goal Progress</span>
                        <strong>{pct}%</strong>
                      </div>
                      <Progress value={pct} />
                    </div>
                  ) : null}

                  <div className="muted" style={{ fontSize: '0.8rem', marginTop: 6, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                    <div>Deadline: <strong>{goal.deadline ?? 'No deadline specified'}</strong></div>
                    <div>Required Pace: <strong>{monthlyNeeded(goal)}</strong></div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      {open ? (
        <GoalModal
          chapter={activeChapter(full)}
          onClose={() => setOpen(false)}
          onSave={(goal) => {
            saveGoal(goal)
            setOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}

function monthlyNeeded(goal: Goal): string {
  if (goal.targetCents === null || goal.currentBalanceCents === null || !goal.deadline) {
    return 'Enter both target, current balance, and deadline.'
  }
  const today = new Date().toISOString().slice(0, 7)
  const months = monthsBetween(today, goal.deadline.slice(0, 7)).length
  if (months <= 0) return 'Deadline reached or in the past.'
  const remaining = goal.targetCents - goal.currentBalanceCents
  if (remaining <= 0) return 'Target already achieved!'
  return `${formatMoney(Math.ceil(remaining / months))} / month for ${months} months`
}

function GoalModal({ chapter, onClose, onSave }: { chapter: 'student' | 'employed'; onClose: () => void; onSave: (goal: Goal) => void }) {
  return (
    <Modal title="Add Financial Goal" onClose={onClose}>
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          const name = String(form.get('name') ?? '').trim()
          if (!name) return
          onSave({
            id: uid('goal'),
            name,
            targetCents: parseAmount(String(form.get('target') ?? '')),
            deadline: String(form.get('deadline') ?? '') || null,
            currentBalanceCents: parseAmount(String(form.get('balance') ?? '')),
            monthlyContributionCents: parseAmount(String(form.get('contribution') ?? '')),
            contributionEstimated: false,
            source: 'manual',
            chapter,
            notes: 'Added from dashboard planner.',
          })
        }}
      >
        <Field label="Goal Name">
          <input name="name" placeholder="e.g. Vacation to India, Car, Tech upgrade" required />
        </Field>
        <Field label="Target Amount (EUR)">
          <input name="target" placeholder="e.g. 3000.00" />
        </Field>
        <Field label="Current Confirmed Balance">
          <input name="balance" placeholder="Leave empty if unknown" />
        </Field>
        <Field label="Target Deadline">
          <input name="deadline" type="date" />
        </Field>
        <Field label="Planned Monthly Contribution">
          <input name="contribution" placeholder="e.g. 150.00" />
        </Field>
        <div className="wide actions" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" type="submit">Save Goal</button>
        </div>
      </form>
    </Modal>
  )
}

export function DebtsPage() {
  const { state: full, saveDebt, deleteDebt } = useStore()
  const state = scopeState(full)
  const [method, setMethod] = useState<'avalanche' | 'snowball'>('avalanche')
  const [extra, setExtra] = useState('100')
  const [open, setOpen] = useState(false)

  const debts = state.debts
  const summary = outstandingDebt(debts)
  const totalPaidCents = debts.reduce(
    (sum, d) => sum + d.payments.reduce((pSum, p) => pSum + p.amountCents, 0),
    0
  )
  const scenario = repaymentScenario(debts, method, parseAmount(extra) ?? 0, new Date().toISOString().slice(0, 7))

  return (
    <div className="stack" style={{ gap: 18 }}>
      <header className="page-head">
        <div>
          <h1>Debt &amp; Loan Repayment Management</h1>
          <p>
            Detailed tracking of original loan items, confirmed repayments, principal versus interest allocations, and payoff simulations using the avalanche and snowball methods.
          </p>
        </div>
        <button type="button" className="btn primary" onClick={() => setOpen(true)}>
          <PlusCircle size={16} /> Add New Debt
        </button>
      </header>

      {/* Summary KPI Cards with nasta-style KpiCard */}
      <section className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <KpiCard
          label="Total Outstanding Debt"
          value={summary.cents / 100}
          icon={Landmark}
          tone="negative"
          badge={summary.unconfirmed ? 'Appa Balance' : 'Confirmed'}
          hint={summary.unconfirmed ? 'Appa loan balance from workbook' : 'Confirmed statement balance'}
        />
        <KpiCard
          label="Total Debt Repaid"
          value={totalPaidCents / 100}
          icon={Receipt}
          tone="positive"
          hint="Across Anna and Appa repayments"
        />
        <KpiCard
          label="Anna Student Debt"
          value={4397}
          format={() => 'Settled in Full'}
          icon={ShieldCheck}
          tone="positive"
          badge="100% Paid"
          hint="€4,395 borrowed · €4,397 paid (€2 overpayment)"
        />
        <KpiCard
          label="Appa Loan Balance"
          value={11500}
          icon={Banknote}
          tone="negative"
          badge="Active"
          hint="€12,760 total · €1,260 repaid"
        />
      </section>

      {/* Debt Acceleration Simulator (Avalanche vs Snowball) */}
      <DebtPayoffSimulator debts={debts} />

      {/* Debts List */}
      <Panel title="Loan Records &amp; Repayments Log">
        <div className="stack" style={{ gap: 14 }}>
          {debts.map((debt) => (
            <DebtCard key={debt.id} debt={debt} onSave={saveDebt} onDelete={deleteDebt} />
          ))}
        </div>
      </Panel>

      {/* Repayment Scenarios (Avalanche vs Snowball) */}
      <ChartChrome
        title="Payoff Strategy Simulation (Avalanche vs. Snowball)"
        hint="Simulate payoff acceleration by applying extra monthly payments"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={method}
              onChange={(event) => setMethod(event.target.value as 'avalanche' | 'snowball')}
              style={{ fontSize: '0.8rem', padding: '4px 8px' }}
            >
              <option value="avalanche">Avalanche Method (Highest interest first)</option>
              <option value="snowball">Snowball Method (Smallest balance first)</option>
            </select>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span className="muted" style={{ fontSize: '0.82rem' }}>Extra Payment:</span>
              <input
                style={{ width: 100, fontSize: '0.82rem', padding: '3px 8px' }}
                value={extra}
                onChange={(event) => setExtra(event.target.value)}
                placeholder="EUR"
              />
            </div>
          </div>
        }
      >
        <div className="stack" style={{ gap: 10, marginTop: 4 }}>
          {scenario.ok ? (
            <div style={{ background: 'var(--surface-2)', padding: '14px', borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <strong>Estimated Debt-Free Date: {scenario.debtFreeMonth ?? 'Achieved'}</strong>
                <Badge tone="ok">{scenario.months} months remaining</Badge>
              </div>
              <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                Total interest payable under scenario: {formatMoney(scenario.interestCents ?? 0)}. Payoff order: {scenario.order?.join(' → ') || 'All balances cleared'}.
              </p>
            </div>
          ) : (
            <Notice tone="warn">{scenario.reason}</Notice>
          )}
          <p className="muted" style={{ fontSize: '0.78rem', margin: 0 }}>
            Assumes fixed rates and consistent monthly allocations. Projections are informational and depend on confirmed terms.
          </p>
        </div>
      </ChartChrome>

      {open ? (
        <DebtModal
          chapter={activeChapter(full)}
          onClose={() => setOpen(false)}
          onSave={(debt) => {
            saveDebt(debt)
            setOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}

function DebtCard({ debt, onSave, onDelete }: { debt: Debt; onSave: (debt: Debt) => void; onDelete: (id: string) => void }) {
  const displayed = debtDisplayedBalance(debt)
  const workbook = debtWorkbookBalance(debt)
  const original = debt.components.reduce((sum, item) => sum + item.amountCents, 0)
  const paid = debt.payments.reduce((sum, payment) => sum + payment.amountCents, 0)
  const isSettled = workbook <= 0

  return (
    <div className="brief-card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <h3 style={{ margin: 0 }}>{debt.name} Debt</h3>
          <span className="muted" style={{ fontSize: '0.8rem' }}>
            {isSettled ? 'Education & Setup costs · Fully settled' : 'Family financial obligation'}
          </span>
        </div>
        <Badge tone={isSettled ? 'ok' : 'warn'}>
          {isSettled ? `Settled (${formatMoney(Math.abs(workbook))} overpaid)` : 'Active Balance'}
        </Badge>
      </div>

      <div className="grid-3" style={{ marginBottom: 10 }}>
        <div>
          <span className="muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Original Principal</span>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{formatMoney(original)}</div>
        </div>
        <div>
          <span className="muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Confirmed Repaid</span>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--green)' }}>{formatMoney(paid)}</div>
        </div>
        <div>
          <span className="muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Current Balance</span>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: isSettled ? 'var(--green)' : 'var(--red)' }}>
            {formatMoney(displayed.cents)}
          </div>
        </div>
      </div>

      {/* Component Details */}
      <details style={{ fontSize: '0.85rem', marginBottom: 10, background: 'var(--surface)', padding: '6px 10px', borderRadius: 6 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Loan Components Breakdown ({debt.components.length} items)</summary>
        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          {debt.components.map((item) => (
            <li key={item.id} style={{ margin: '3px 0' }}>
              {item.name}: <strong>{formatMoney(item.amountCents)}</strong> {item.sourceCell ? `(${item.sourceCell})` : ''}
            </li>
          ))}
        </ul>
      </details>

      {/* Payment History */}
      {debt.payments.length ? (
        <details style={{ fontSize: '0.85rem', marginBottom: 10, background: 'var(--surface)', padding: '6px 10px', borderRadius: 6 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Repayment History ({debt.payments.length} transactions)</summary>
          <div className="table-wrap" style={{ marginTop: 6 }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="num">Paid</th>
                  <th className="num">Principal</th>
                  <th className="num">Interest</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {debt.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.date ?? '—'}</td>
                    <td className="num">{formatMoney(p.amountCents)}</td>
                    <td className="num">{formatMoney(p.principalCents)}</td>
                    <td className="num">{formatMoney(p.interestCents)}</td>
                    <td className="meta">{p.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}

      {/* Editable Debt Parameters */}
      <div className="form-grid" style={{ fontSize: '0.85rem', background: 'var(--surface-2)', padding: 10, borderRadius: 8, marginBottom: 8 }}>
        <Field label="Annual Interest Rate (%)">
          <input
            type="number"
            step="0.1"
            defaultValue={debt.interestRateAnnual ?? ''}
            placeholder="0 for 0% interest"
            onBlur={(event) => onSave({ ...debt, interestRateAnnual: event.target.value ? Number(event.target.value) : null })}
          />
        </Field>
        <Field label="Monthly Minimum Payment">
          <input
            defaultValue={debt.minimumPaymentCents !== null ? (debt.minimumPaymentCents / 100).toFixed(2) : ''}
            placeholder="e.g. 200.00"
            onBlur={(event) => onSave({ ...debt, minimumPaymentCents: event.target.value.trim() ? parseAmount(event.target.value) : null })}
          />
        </Field>
        <Field label="Monthly Due Day (1–28)">
          <input
            type="number"
            min={1}
            max={28}
            defaultValue={debt.dueDay ?? ''}
            placeholder="e.g. 1"
            onBlur={(event) => onSave({ ...debt, dueDay: event.target.value ? Number(event.target.value) : null })}
          />
        </Field>
      </div>

      {/* Record Repayment Form */}
      <form
        className="filters"
        style={{ alignItems: 'center', background: 'var(--surface)', padding: 8, borderRadius: 6 }}
        onSubmit={(event) => {
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
            payments: [
              ...debt.payments,
              {
                id: uid('pay'),
                amountCents: amount,
                principalCents: principal,
                interestCents: interest,
                date: date || null,
                note: 'Recorded in dashboard. Principal deducted.',
              },
            ],
          })
          event.currentTarget.reset()
        }}
      >
        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Record Payment:</span>
        <input name="date" type="date" aria-label="Date" defaultValue={new Date().toISOString().slice(0, 10)} />
        <input name="amount" placeholder="Payment Amount" style={{ width: 110 }} required />
        <input name="interest" placeholder="Interest (EUR)" style={{ width: 100 }} defaultValue="0.00" />
        <button className="btn primary" type="submit" style={{ fontSize: '0.8rem' }}>Save Payment</button>
      </form>

      {debt.source === 'manual' ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <button type="button" className="btn ghost danger" style={{ fontSize: '0.78rem' }} onClick={() => onDelete(debt.id)}>
            Delete Debt
          </button>
        </div>
      ) : null}
    </div>
  )
}

function DebtModal({ chapter, onClose, onSave }: { chapter: 'student' | 'employed'; onClose: () => void; onSave: (debt: Debt) => void }) {
  return (
    <Modal title="Add Debt or Loan" onClose={onClose}>
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          const name = String(form.get('name') ?? '').trim()
          const original = parseAmount(String(form.get('original') ?? ''))
          if (!name || original === null || original <= 0) return
          onSave({
            id: uid('debt'),
            name,
            components: [{ id: uid('part'), name: 'Initial Principal', amountCents: original }],
            payments: [],
            interestRateAnnual: form.get('rate') ? Number(form.get('rate')) : null,
            minimumPaymentCents: parseAmount(String(form.get('minimum') ?? '')),
            confirmedBalanceCents: parseAmount(String(form.get('balance') ?? '')) ?? original,
            dueDay: form.get('due') ? Number(form.get('due')) : null,
            source: 'manual',
            chapter,
            notes: 'Added from debt manager.',
          })
        }}
      >
        <Field label="Debt Name">
          <input name="name" placeholder="e.g. Bank Loan, Family Support, Laptop" required />
        </Field>
        <Field label="Original Principal Amount (EUR)">
          <input name="original" placeholder="e.g. 5000.00" required />
        </Field>
        <Field label="Current Outstanding Balance">
          <input name="balance" placeholder="Leave blank if equal to original" />
        </Field>
        <Field label="Annual Interest Rate %">
          <input name="rate" placeholder="e.g. 3.5 or 0" />
        </Field>
        <Field label="Monthly Minimum Payment">
          <input name="minimum" placeholder="e.g. 150.00" />
        </Field>
        <Field label="Due Day (1–28)">
          <input name="due" type="number" min={1} max={28} placeholder="e.g. 1" />
        </Field>
        <div className="wide actions" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" type="submit">Save Debt</button>
        </div>
      </form>
    </Modal>
  )
}

export function CalendarPage() {
  const { state: full, saveBill } = useStore()
  const state = scopeState(full)
  const month = state.filters.month === 'all' ? new Date().toISOString().slice(0, 7) : state.filters.month
  const [year, mon] = month.split('-').map(Number)
  const first = new Date(Date.UTC(year, mon - 1, 1)).getUTCDay()
  const count = daysInMonth(month)
  const cells = [...Array(first).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)]

  const recorded = state.transactions.filter((t) => t.date.startsWith(month) && t.origin === 'actual')
  const unknown = recorded.filter((t) => !t.dayKnown)
  const planned = state.bills.filter((b) => b.active)

  // Estimated cash flow for the selected calendar month
  const scheduledIncome = recorded.filter((t) => t.kind === 'income').reduce((sum, t) => sum + t.amountCents, 0)
  const scheduledBillsTotal = planned.reduce((sum, b) => sum + b.amountCents, 0)
  const projectedBuffer = scheduledIncome - scheduledBillsTotal

  return (
    <div className="stack" style={{ gap: 18 }}>
      <header className="page-head">
        <div>
          <h1>Financial Calendar &amp; Upcoming Obligations</h1>
          <p>
            {monthLabel(month)}. Monthly view of confirmed historical transactions and scheduled recurring bills (rent, Deutschlandticket, insurance, subscriptions).
          </p>
        </div>
      </header>

      {/* Cash Flow Forecast Card with nasta-style KpiCard */}
      <section className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <KpiCard
          label={`Confirmed Income in ${month}`}
          value={scheduledIncome / 100}
          icon={Banknote}
          tone="positive"
          hint="Recorded earnings &amp; deposits"
        />
        <KpiCard
          label="Scheduled Recurring Bills"
          value={scheduledBillsTotal / 100}
          icon={Receipt}
          tone="negative"
          hint={`${planned.length} active bills configured`}
        />
        <KpiCard
          label="Projected Cash Buffer"
          value={projectedBuffer / 100}
          icon={CalendarClock}
          tone={projectedBuffer >= 0 ? 'positive' : 'negative'}
          badge={projectedBuffer >= 0 ? 'Buffer positive' : 'Deficit'}
          hint="Income minus scheduled obligations"
        />
      </section>

      {/* Subscription & Recurring Leaks Detector */}
      <SubscriptionDetector transactions={state.transactions} />

      {/* Unallocated Day Warning */}
      {unknown.length ? (
        <details style={{ background: 'var(--surface-2)', padding: '8px 12px', borderRadius: 8, fontSize: '0.85rem' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
            {unknown.length} recorded items in {month} have no calendar day specified (Click to inspect)
          </summary>
          <div style={{ maxHeight: 150, overflow: 'auto', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {unknown.map((t) => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 2 }}>
                <span>{t.description}</span>
                <strong>{formatMoney(t.amountCents)}</strong>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {/* Monthly Calendar Grid */}
      <div className="calendar">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="dow">{day}</div>
        ))}
        {cells.map((day, index) => {
          if (!day) return <div key={index} className="day muted-day" />
          const dateStr = `${month}-${String(day).padStart(2, '0')}`
          const dayItems = recorded.filter((t) => t.date === dateStr)
          const dueBills = planned.filter((b) => b.dueDay === day)
          return (
            <div key={index} className="day">
              <strong>{day}</strong>
              {dayItems.map((item) => (
                <span
                  key={item.id}
                  className="pill"
                  title={`${item.description} - ${formatMoney(item.amountCents)}`}
                >
                  {formatMoney(item.amountCents)} {item.description}
                </span>
              ))}
              {dueBills.map((bill) => (
                <span
                  key={bill.id}
                  className="pill plan"
                  title={`Scheduled Bill: ${bill.name} - ${formatMoney(bill.amountCents)}`}
                >
                  ⏳ {formatMoney(bill.amountCents)} {bill.name}
                </span>
              ))}
            </div>
          )
        })}
      </div>

      {/* Recurring Bills Configuration */}
      <Panel title="Recurring Bills &amp; Subscription Schedule">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Bill Name</th>
                <th>Due Day</th>
                <th className="num">Amount</th>
                <th>Frequency</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {state.bills.map((bill) => (
                <tr key={bill.id}>
                  <td>
                    <strong>{bill.name}</strong>
                  </td>
                  <td>
                    Day {bill.dueDay} of month
                  </td>
                  <td className="num" style={{ fontWeight: 600 }}>
                    {formatMoney(bill.amountCents)}
                  </td>
                  <td>
                    <select
                      defaultValue={bill.interval}
                      onChange={(e) => saveBill({ ...bill, interval: e.target.value as 'monthly' | 'quarterly' | 'yearly' })}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`btn ${bill.active ? 'primary' : 'ghost'}`}
                      style={{ fontSize: '0.8rem', padding: '3px 8px' }}
                      onClick={() => saveBill({ ...bill, active: !bill.active })}
                    >
                      {bill.active ? 'Active' : 'Paused'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

export function ForecastPage() {
  const { state: full } = useStore()
  const state = scopeState(full)
  const [count, setCount] = useState<6 | 12>(6)
  const [scenario, setScenario] = useState<ScenarioIdFix>('expected')
  const model = forecastFor(state, count, scenario)

  // Totals across forecast horizon
  const totals = useMemo(() => {
    let income = 0
    let expense = 0
    let savings = 0
    let debt = 0
    let endingBuffer = 0
    for (const m of model.months) {
      income += m.incomeCents ?? 0
      expense += m.expenseCents ?? 0
      savings += m.savingsTransferCents ?? 0
      debt += m.debtPaymentCents ?? 0
      endingBuffer += m.cashFlowCents ?? 0
    }
    return { income, expense, savings, debt, endingBuffer }
  }, [model.months])

  return (
    <div className="stack" style={{ gap: 18 }}>
      <header className="page-head">
        <div>
          <h1>Financial Forecasting (6 &amp; 12 Month Horizon)</h1>
          <p>
            Dynamic projections synthesized from historical spending run-rates, confirmed salary contracts, and recurring debt &amp; savings obligations.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className={`btn ${count === 6 ? 'primary' : 'ghost'}`} onClick={() => setCount(6)}>
            6 Months
          </button>
          <button type="button" className={`btn ${count === 12 ? 'primary' : 'ghost'}`} onClick={() => setCount(12)}>
            12 Months
          </button>
        </div>
      </header>

      {/* Scenario Tabs */}
      <div className="filters" style={{ alignItems: 'center' }}>
        <span className="muted" style={{ fontSize: '0.85rem' }}>Select Scenario:</span>
        {(['conservative', 'expected', 'optimistic'] as ScenarioIdFix[]).map((id) => (
          <button
            type="button"
            key={id}
            className={`btn ${scenario === id ? 'primary' : 'ghost'}`}
            onClick={() => setScenario(id)}
          >
            {id[0].toUpperCase() + id.slice(1)} Scenario
          </button>
        ))}
      </div>

      <Notice>{model.scenario.summary}</Notice>

      {/* Horizon Overview Stats with nasta-style KpiCard */}
      <section className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <KpiCard
          label={`Projected ${count}-Month Income`}
          value={totals.income / 100}
          icon={Banknote}
          tone="positive"
          hint={`${count} month outlook`}
        />
        <KpiCard
          label="Projected Living Spending"
          value={totals.expense / 100}
          icon={Receipt}
          hint="Rent, food &amp; utilities"
        />
        <KpiCard
          label="Projected Savings &amp; Investments"
          value={totals.savings / 100}
          icon={TrendingUp}
          tone="positive"
          hint="SIP, Gold &amp; Emergency allocations"
        />
        <KpiCard
          label="Cumulative Cash Left Over"
          value={totals.endingBuffer / 100}
          icon={LineChartIcon}
          tone={totals.endingBuffer >= 0 ? 'positive' : 'negative'}
          hint="Unallocated liquid buffer"
        />
      </section>

      {/* Forecast Line Chart with ChartChrome */}
      <ChartChrome
        title={`Projected Cash Flow Trajectory (${count} Months)`}
        hint={`Monthly trajectory under the ${scenario} scenario`}
      >
        <div className="chart">
          <ResponsiveContainer>
            <LineChart
              data={model.months.map((m) => ({
                label: m.month.slice(2),
                income: m.incomeCents === null ? null : m.incomeCents / 100,
                expense: m.expenseCents === null ? null : m.expenseCents / 100,
                cash: m.cashFlowCents === null ? null : m.cashFlowCents / 100,
              }))}
            >
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(value) => formatMoney(Math.round(Number(value) * 100))}
              />
              <Legend />
              <Line dataKey="income" name="Projected Income" stroke="#10b981" strokeWidth={2.2} dot={false} />
              <Line dataKey="expense" name="Projected Spending" stroke="#f43f5e" strokeWidth={2.2} dot={false} />
              <Line dataKey="cash" name="Net Monthly Buffer" stroke="#0f766e" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartChrome>

      {/* Month-by-Month Tabular Schedule */}
      <Panel title="Month-by-Month Financial Projection">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th className="num">Net Income</th>
                <th className="num">Living Expenses</th>
                <th className="num">Savings Transfers</th>
                <th className="num">Debt Payments</th>
                <th className="num">Month-End Buffer</th>
              </tr>
            </thead>
            <tbody>
              {model.months.map((m) => (
                <tr key={m.month}>
                  <td><strong>{m.month}</strong></td>
                  <td className="num">{formatMoney(m.incomeCents)}</td>
                  <td className="num">{formatMoney(m.expenseCents)}</td>
                  <td className="num">{formatMoney(m.savingsTransferCents)}</td>
                  <td className="num">{formatMoney(m.debtPaymentCents)}</td>
                  <td className={`num ${(m.cashFlowCents ?? 0) >= 0 ? 'tone-good' : 'tone-bad'}`} style={{ fontWeight: 600 }}>
                    {formatMoney(m.cashFlowCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
