import { formatMoney } from '../lib/money'
import { PieChart as PieIcon } from 'lucide-react'

interface FiftyThirtyTwentyCardProps {
  incomeCents: number
  needsCents: number
  wantsCents: number
  savingsCents: number
  onPillarClick?: (pillar: 'needs' | 'wants' | 'savings') => void
}

export function FiftyThirtyTwentyCard({
  incomeCents,
  needsCents,
  wantsCents,
  savingsCents,
  onPillarClick,
}: FiftyThirtyTwentyCardProps) {
  const totalIn = Math.max(incomeCents, 1)

  const actualNeedsPct = Math.round((needsCents / totalIn) * 100)
  const actualWantsPct = Math.round((wantsCents / totalIn) * 100)
  const actualSavingsPct = Math.round((Math.max(0, savingsCents) / totalIn) * 100)

  return (
    <div className="ftt-card">
      <div className="ftt-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="kpi-icon kpi-icon--accent" style={{ width: 34, height: 34 }}>
            <PieIcon size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>50 / 30 / 20 Budget Rule Balance</h3>
            <p className="muted" style={{ fontSize: '0.76rem', margin: '2px 0 0' }}>
              Optimal balance between Needs (50%), Wants (30%), and Wealth Building (20%)
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 14 }}>
        {/* Needs (50%) */}
        <div
          className="ftt-pillar is-interactive"
          role="button"
          tabIndex={0}
          onClick={() => onPillarClick?.('needs')}
          onKeyDown={(e) => e.key === 'Enter' && onPillarClick?.('needs')}
          title="Click to view all Needs & Living Costs"
        >
          <div className="ftt-pillar__top">
            <span className="ftt-pillar__name" style={{ color: '#6366f1' }}>Needs (Target 50%)</span>
            <strong className="ftt-pillar__pct">{actualNeedsPct}%</strong>
          </div>
          <div className="ftt-pillar__val">{formatMoney(needsCents)}</div>
          <div className="ftt-pillar__track">
            <div className="ftt-pillar__bar" style={{ width: `${Math.min(100, actualNeedsPct)}%`, background: '#6366f1' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
            <span className="muted" style={{ fontSize: '0.72rem' }}>Rent, bills, groceries, transit</span>
            <span className="ftt-action-link" style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: 700 }}>Inspect &rarr;</span>
          </div>
        </div>

        {/* Wants (30%) */}
        <div
          className="ftt-pillar is-interactive"
          role="button"
          tabIndex={0}
          onClick={() => onPillarClick?.('wants')}
          onKeyDown={(e) => e.key === 'Enter' && onPillarClick?.('wants')}
          title="Click to view all Wants & Lifestyle Spend"
        >
          <div className="ftt-pillar__top">
            <span className="ftt-pillar__name" style={{ color: '#f59e0b' }}>Wants (Target 30%)</span>
            <strong className="ftt-pillar__pct">{actualWantsPct}%</strong>
          </div>
          <div className="ftt-pillar__val">{formatMoney(wantsCents)}</div>
          <div className="ftt-pillar__track">
            <div className="ftt-pillar__bar" style={{ width: `${Math.min(100, actualWantsPct)}%`, background: '#f59e0b' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
            <span className="muted" style={{ fontSize: '0.72rem' }}>Dining, hobbies, travel, shopping</span>
            <span className="ftt-action-link" style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 700 }}>Inspect &rarr;</span>
          </div>
        </div>

        {/* Savings (20%) */}
        <div
          className="ftt-pillar is-interactive"
          role="button"
          tabIndex={0}
          onClick={() => onPillarClick?.('savings')}
          onKeyDown={(e) => e.key === 'Enter' && onPillarClick?.('savings')}
          title="Click to manage savings & investment goals"
        >
          <div className="ftt-pillar__top">
            <span className="ftt-pillar__name" style={{ color: '#10b981' }}>Savings &amp; SIP (Target 20%)</span>
            <strong className="ftt-pillar__pct">{actualSavingsPct}%</strong>
          </div>
          <div className="ftt-pillar__val" style={{ color: 'var(--ok)' }}>{formatMoney(Math.max(0, savingsCents))}</div>
          <div className="ftt-pillar__track">
            <div className="ftt-pillar__bar" style={{ width: `${Math.min(100, actualSavingsPct)}%`, background: '#10b981' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
            <span className="muted" style={{ fontSize: '0.72rem' }}>ETFs, emergency fund, gold</span>
            <span className="ftt-action-link" style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>Manage &rarr;</span>
          </div>
        </div>
      </div>
    </div>
  )
}
