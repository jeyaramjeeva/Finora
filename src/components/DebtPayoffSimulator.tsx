import { useState } from 'react'
import { formatMoney } from '../lib/money'
import { Landmark } from 'lucide-react'
import type { Debt } from '../lib/types'

interface DebtPayoffSimulatorProps {
  debts: Debt[]
}

export function DebtPayoffSimulator({ debts }: DebtPayoffSimulatorProps) {
  const [strategy, setStrategy] = useState<'avalanche' | 'snowball'>('avalanche')
  const [extraPaymentCents, setExtraPaymentCents] = useState(10000) // €100/mo extra

  const totalOutstandingCents = debts.reduce((sum, d) => {
    const bal = d.confirmedBalanceCents ?? d.components.reduce((cSum, c) => cSum + c.amountCents, 0)
    return sum + bal
  }, 0)

  // Standard baseline payment without extra (e.g. €300/mo)
  const baselineMonthlyCents = Math.max(25000, Math.round(totalOutstandingCents / 36))
  const totalMonthlyPaymentCents = baselineMonthlyCents + extraPaymentCents

  // Simulate months to debt-free
  const monthsRemaining = totalMonthlyPaymentCents > 0
    ? Math.ceil(totalOutstandingCents / totalMonthlyPaymentCents)
    : 0
  const baselineMonths = baselineMonthlyCents > 0
    ? Math.ceil(totalOutstandingCents / baselineMonthlyCents)
    : 0
  const monthsSaved = Math.max(0, baselineMonths - monthsRemaining)

  return (
    <div className="debt-sim-card">
      <div className="debt-sim-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="kpi-icon kpi-icon--negative" style={{ width: 34, height: 34 }}>
            <Landmark size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>Debt Payoff &amp; Acceleration Modeler</h3>
            <p className="muted" style={{ fontSize: '0.76rem', margin: '2px 0 0' }}>
              Avalanche vs. Snowball payoff comparison for active loans
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            className={`btn ghost ${strategy === 'avalanche' ? 'active' : ''}`}
            style={{ fontSize: '0.76rem', padding: '4px 8px' }}
            onClick={() => setStrategy('avalanche')}
          >
            Avalanche (Interest)
          </button>
          <button
            type="button"
            className={`btn ghost ${strategy === 'snowball' ? 'active' : ''}`}
            style={{ fontSize: '0.76rem', padding: '4px 8px' }}
            onClick={() => setStrategy('snowball')}
          >
            Snowball (Fastest win)
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginTop: 14 }}>
        {/* Extra payment slider */}
        <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Extra Monthly Paydown:</span>
            <strong style={{ color: 'var(--ok)' }}>+{formatMoney(extraPaymentCents)} / mo</strong>
          </div>
          <input
            type="range"
            min="0"
            max="50000"
            step="2500"
            value={extraPaymentCents}
            onChange={(e) => setExtraPaymentCents(parseInt(e.target.value, 10))}
            style={{ width: '100%', accentColor: 'var(--ok)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--muted)', marginTop: 4 }}>
            <span>+€0</span>
            <span>+€250</span>
            <span>+€500</span>
          </div>
        </div>

        {/* Acceleration Results */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ padding: 10, borderRadius: 10, background: 'var(--surface-2)' }}>
            <span className="muted" style={{ fontSize: '0.72rem', fontWeight: 600 }}>Estimated Debt-Free</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: 2 }}>{monthsRemaining} months</div>
            <span className="muted" style={{ fontSize: '0.7rem' }}>~{(monthsRemaining / 12).toFixed(1)} years</span>
          </div>

          <div style={{ padding: 10, borderRadius: 10, background: 'var(--surface-2)' }}>
            <span className="muted" style={{ fontSize: '0.72rem', fontWeight: 600 }}>Time Shaved Off</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: 2, color: 'var(--ok)' }}>
              {monthsSaved > 0 ? `-${monthsSaved} months` : 'Baseline'}
            </div>
            <span className="muted" style={{ fontSize: '0.7rem' }}>Accelerated freedom</span>
          </div>
        </div>
      </div>
    </div>
  )
}
