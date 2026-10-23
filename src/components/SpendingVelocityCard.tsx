import { formatMoney } from '../lib/money'
import { Zap, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface SpendingVelocityCardProps {
  currentSpendCents: number
  monthlyBudgetCents: number
  daysElapsed: number
  totalDaysInMonth: number
}

export function SpendingVelocityCard({
  currentSpendCents,
  monthlyBudgetCents,
  daysElapsed,
  totalDaysInMonth,
}: SpendingVelocityCardProps) {
  const safeDays = Math.max(1, daysElapsed)
  const dailyBurnCents = Math.round(currentSpendCents / safeDays)
  const projectedFinishCents = dailyBurnCents * totalDaysInMonth

  const timePct = Math.min(100, Math.round((safeDays / totalDaysInMonth) * 100))
  const spendPct = monthlyBudgetCents > 0 ? Math.min(100, Math.round((currentSpendCents / monthlyBudgetCents) * 100)) : 0
  const isPacingOver = monthlyBudgetCents > 0 && projectedFinishCents > monthlyBudgetCents

  return (
    <div className="velocity-card">
      <div className="velocity-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className={`kpi-icon ${isPacingOver ? 'kpi-icon--negative' : 'kpi-icon--positive'}`} style={{ width: 34, height: 34 }}>
            <Zap size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>Spending Velocity &amp; Projected Finish</h3>
            <p className="muted" style={{ fontSize: '0.76rem', margin: '2px 0 0' }}>
              Day {safeDays} of {totalDaysInMonth} ({timePct}% of month elapsed · {spendPct}% budget utilized)
            </p>
          </div>
        </div>

        <span className={`status-pill ${isPacingOver ? '' : 'ok'}`} style={isPacingOver ? { color: 'var(--danger)', borderColor: 'var(--danger)' } : {}}>
          {isPacingOver ? 'Pacing Ahead' : 'Pacing On Track'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
        <div style={{ padding: 12, borderRadius: 10, background: 'var(--surface-2)' }}>
          <span className="muted" style={{ fontSize: '0.74rem', fontWeight: 600 }}>Current Daily Burn Rate</span>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: 2 }}>{formatMoney(dailyBurnCents)} / day</div>
        </div>

        <div style={{ padding: 12, borderRadius: 10, background: 'var(--surface-2)' }}>
          <span className="muted" style={{ fontSize: '0.74rem', fontWeight: 600 }}>Projected Month-End Spend</span>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: 2, color: isPacingOver ? 'var(--danger)' : 'var(--text)' }}>
            {formatMoney(projectedFinishCents)}
          </div>
        </div>
      </div>

      {monthlyBudgetCents > 0 && (
        <div style={{ marginTop: 12, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}>
          {isPacingOver ? (
            <>
              <AlertTriangle size={15} style={{ color: 'var(--danger)' }} />
              <span>Projected to exceed budget by <strong>{formatMoney(projectedFinishCents - monthlyBudgetCents)}</strong></span>
            </>
          ) : (
            <>
              <CheckCircle2 size={15} style={{ color: 'var(--ok)' }} />
              <span>Pacing to finish within budget with <strong>{formatMoney(monthlyBudgetCents - projectedFinishCents)}</strong> surplus buffer</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
