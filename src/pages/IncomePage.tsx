import { useMemo } from 'react'
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
import { Wallet, Briefcase, Landmark, ShieldCheck } from 'lucide-react'
import { Badge, Field, Panel } from '../components/ui'
import { KpiCard } from '../components/KpiCard'
import { ChartChrome, chartTooltipStyle } from '../components/ChartChrome'
import { activeChapter, scopeState } from '../lib/chapter'
import { monthLabel } from '../lib/dates'
import { estimatePayslip } from '../lib/forecast'
import { formatMoney, formatPercent } from '../lib/money'
import { monthFigures } from '../lib/calc'
import { colorFor, trend } from '../lib/selectors'
import type { DeductionRates } from '../lib/types'
import { useStore } from '../state/store'

export function IncomePage() {
  const { state: full, update } = useStore()
  const state = scopeState(full)
  const employed = activeChapter(state) === 'employed'
  const history = trend(state, state.filters.month)
  const plan = state.incomePlans[0]
  const payslip = plan ? estimatePayslip(plan.grossMonthlyCents, state.assumptions.rates) : null
  const selected = state.filters.month === 'all' ? null : monthFigures(state.transactions, state.filters.month, state.coverage.find((row) => row.month === state.filters.month))

  // Annual income aggregation
  const annualData = useMemo(() => {
    const years = new Map<string, { earnings: number; received: number }>()
    for (const t of state.transactions) {
      if (t.kind !== 'income' || t.origin !== 'actual') continue
      const y = t.date.slice(0, 4)
      const current = years.get(y) ?? { earnings: 0, received: 0 }
      if (t.categoryId === 'earnings' || t.description.toLowerCase().includes('earnings')) {
        current.earnings += t.amountCents
      } else {
        current.received += t.amountCents
      }
      years.set(y, current)
    }
    const rows = [...years.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([year, val]) => ({
      year,
      earnings: val.earnings / 100,
      received: val.received / 100,
      total: (val.earnings + val.received) / 100,
    }))
    if (plan) {
      const annualNet = ((payslip?.netCents ?? 0) * 12) / 100
      rows.push({
        year: '2027 (Plan)',
        earnings: annualNet,
        received: 0,
        total: annualNet,
      })
    }
    return rows
  }, [state.transactions, plan, payslip])

  // Deductions pie slices for full time
  const deductionSlices = useMemo(() => {
    if (!payslip) return []
    return payslip.lines.filter((l) => l.key !== 'gross' && l.key !== 'net').map((l) => ({
      name: l.label,
      value: l.cents / 100,
      cents: l.cents,
    }))
  }, [payslip])

  function setRate(key: keyof DeductionRates, raw: string) {
    const percent = Number(raw)
    if (!Number.isFinite(percent) || percent < 0 || percent > 80) return
    update((current) => ({
      ...current,
      assumptions: {
        ...current.assumptions,
        rates: { ...current.assumptions.rates, [key]: percent / 100 },
      },
    }))
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <header className="page-head">
        <div>
          <h1>{employed ? 'Full-Time Income & Payroll Analysis' : 'Student Income & Earnings Tracking'}</h1>
          <p>
            {employed
              ? 'Statutory payroll breakdown for your planned full-time employment, including wage tax and mandatory social insurances.'
              : 'Working student earnings and family support records from December 2023 through February 2026.'}
          </p>
        </div>
      </header>

      {/* KPI Stats with nasta-style KpiCard */}
      <section className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <KpiCard
          label="Actual Income in View"
          value={(selected?.incomeCents ?? 0) / 100}
          icon={Wallet}
          tone="positive"
          hint={selected ? monthLabel(state.filters.month) : 'Select a month to inspect payslip'}
        />
        <KpiCard
          label={employed ? 'Contracted Gross' : 'Student Earnings Total'}
          value={employed && plan ? plan.grossMonthlyCents / 100 : 21966}
          icon={Briefcase}
          tone="positive"
          hint={employed && plan ? `${plan.employer} · Stuttgart` : 'Total student wages earned'}
        />
        <KpiCard
          label={employed ? 'Estimated Net Monthly' : 'External Support Total'}
          value={employed && payslip ? payslip.netCents / 100 : 14965}
          icon={Landmark}
          tone="positive"
          hint={employed && payslip ? `${formatPercent(payslip.deductionPercent)} total deductions` : 'Blocked account & family transfers'}
        />
        <KpiCard
          label={employed ? 'Monthly Deductions' : 'Tax Exemption Status'}
          value={employed && payslip ? payslip.deductionCents / 100 : 0}
          format={(n) => employed ? formatMoney(Math.round(n * 100)) : 'Tax Exempt'}
          icon={ShieldCheck}
          tone={employed ? 'negative' : 'positive'}
          hint={employed ? 'Tax, pension, health & care' : 'Student social security privilege'}
        />
      </section>

      {/* Charts Grid */}
      <div className="grid-2">
        <ChartChrome
          title="Monthly Net Income Trends"
          hint="Net earnings history across all recorded months"
          actions={<Badge tone="ok">Historical</Badge>}
        >
          <div className="chart">
            <ResponsiveContainer>
              <LineChart data={history}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value) => formatMoney(Math.round(Number(value) * 100))}
                />
                <Line type="monotone" dataKey="income" name="Net Income" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartChrome>

        <ChartChrome
          title="Annual Income Breakdown"
          hint="Earnings vs external transfers by calendar year"
          actions={<Badge tone="ok">Multi-Year</Badge>}
        >
          <div className="chart">
            <ResponsiveContainer>
              <BarChart data={annualData}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="year" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value) => formatMoney(Math.round(Number(value) * 100))}
                />
                <Legend />
                <Bar dataKey="earnings" name="Work Earnings" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="received" name="Transfers Received" fill="#0f766e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartChrome>
      </div>

      {/* Full-time statutory deductions breakdown */}
      {employed && payslip && plan ? (
        <div className="grid-2">
          <ChartChrome
            title="German Statutory Payroll Deductions (Stuttgart)"
            hint="Breakdown of income tax and social insurance components"
          >
            <div className="chart">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={deductionSlices}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {deductionSlices.map((slice, idx) => (
                      <Cell key={idx} fill={colorFor(slice.name)} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(value) => formatMoney(Math.round(Number(value) * 100))}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartChrome>

          <Panel title="Payslip Line Items & Assumption Rates">
            <div className="stack" style={{ gap: 10 }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Line Item</th>
                      <th className="num">Rate</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payslip.lines.map((line) => (
                      <tr key={line.key}>
                        <td>
                          <strong>{line.label}</strong>
                        </td>
                        <td className="num">{line.rate ? formatPercent(line.rate * 100) : '—'}</td>
                        <td className={`num ${line.cents < 0 ? 'tone-bad' : 'tone-good'}`} style={{ fontWeight: 600 }}>
                          {formatMoney(line.cents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                <span className="muted" style={{ fontSize: '0.8rem', display: 'block', marginBottom: 8 }}>
                  Adjust statutory rate assumptions (%):
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                  <Field label="Pension">
                    <input
                      type="number"
                      step="0.1"
                      defaultValue={(state.assumptions.rates.pension * 100).toFixed(1)}
                      onBlur={(e) => setRate('pension', e.target.value)}
                    />
                  </Field>
                  <Field label="Health">
                    <input
                      type="number"
                      step="0.1"
                      defaultValue={(state.assumptions.rates.health * 100).toFixed(1)}
                      onBlur={(e) => setRate('health', e.target.value)}
                    />
                  </Field>
                  <Field label="Unemployment">
                    <input
                      type="number"
                      step="0.1"
                      defaultValue={(state.assumptions.rates.unemployment * 100).toFixed(1)}
                      onBlur={(e) => setRate('unemployment', e.target.value)}
                    />
                  </Field>
                  <Field label="Long-term Care">
                    <input
                      type="number"
                      step="0.1"
                      defaultValue={(state.assumptions.rates.longTermCare * 100).toFixed(1)}
                      onBlur={(e) => setRate('longTermCare', e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      ) : null}

      {/* Student Life Career Timeline */}
      {!employed ? (
        <Panel title="Student Career & Income Milestones">
          <div className="list">
            <div className="row-card">
              <div>
                <strong>Student Wage History (Dec 2023 – Feb 2026)</strong>
                <p className="muted" style={{ fontSize: '0.82rem' }}>
                  Total of 34 recorded earnings deposits totaling €21,966.00 across part-time student employment.
                </p>
              </div>
              <Badge tone="ok">34 Paychecks</Badge>
            </div>
            <div className="row-card">
              <div>
                <strong>External Support & Blocked Account Transfers</strong>
                <p className="muted" style={{ fontSize: '0.82rem' }}>
                  25 transfer events totaling €14,965.00 logged as transfers from parents / blocked account release.
                </p>
              </div>
              <Badge>25 Events</Badge>
            </div>
            <div className="row-card">
              <div>
                <strong>Transition to Full-Time Career (2027+)</strong>
                <p className="muted" style={{ fontSize: '0.82rem' }}>
                  Planned graduation and start of full-time role in Stuttgart with €3,500.00 gross monthly contract.
                </p>
              </div>
              <Badge tone="ok">Target €2,240 Net</Badge>
            </div>
          </div>
        </Panel>
      ) : null}
    </div>
  )
}
