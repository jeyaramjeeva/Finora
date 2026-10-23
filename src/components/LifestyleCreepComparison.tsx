import { formatMoney } from '../lib/money'
import { ArrowRight, ShieldCheck, TrendingUp } from 'lucide-react'

export function LifestyleCreepComparison() {
  const studentNet = 110000 // ~€1,100
  const studentLiving = 78000 // €780
  const studentSavings = 32000 // €320

  const employedNet = 224000 // ~€2,240
  const employedLiving = 128000 // €1,280
  const employedSavings = 96000 // €960 (ETF, SIP, emergency)

  const netIncrease = employedNet - studentNet // +€1,140
  const spendIncrease = employedLiving - studentLiving // +€500
  const savingsIncrease = employedSavings - studentSavings // +€640

  const creepPct = Math.round((spendIncrease / netIncrease) * 100)
  const wealthCapturePct = 100 - creepPct

  return (
    <div className="sankey-card">
      <div className="sankey-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="kpi-icon kpi-icon--positive" style={{ width: 34, height: 34 }}>
            <TrendingUp size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>Student &rarr; Full-Time Lifestyle Creep Comparison</h3>
            <p className="muted" style={{ fontSize: '0.76rem', margin: '2px 0 0' }}>
              Side-by-side transition analysis: where your increased post-graduation income goes
            </p>
          </div>
        </div>

        <span className="status-pill ok">
          <ShieldCheck size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          Healthy Wealth Capture ({wealthCapturePct}%)
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'center', marginTop: 16 }}>
        {/* Student Column */}
        <div style={{ padding: 14, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>
            Student Life Stage (Actual Baseline)
          </span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: 4 }}>
            {formatMoney(studentNet)} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' }}>/ mo net</span>
          </div>

          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="muted">Living Costs:</span>
              <strong>{formatMoney(studentLiving)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="muted">Savings Buffer:</span>
              <strong style={{ color: 'var(--ok)' }}>{formatMoney(studentSavings)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="muted">Savings Rate:</span>
              <strong>29.1%</strong>
            </div>
          </div>
        </div>

        {/* Transition Arrow */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: 'var(--muted)' }}>
          <ArrowRight size={22} style={{ color: 'var(--ok)' }} />
          <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>+{formatMoney(netIncrease)}</span>
        </div>

        {/* Employed Column */}
        <div style={{ padding: 14, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--ok)' }}>
            Full-Time Career Stage (Planned)
          </span>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: 4, color: 'var(--ok)' }}>
            {formatMoney(employedNet)} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' }}>/ mo net</span>
          </div>

          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="muted">Living Costs (Warmmiete + life):</span>
              <strong>{formatMoney(employedLiving)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="muted">Wealth Building (SIP/ETF/Gold):</span>
              <strong style={{ color: 'var(--ok)' }}>{formatMoney(employedSavings)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="muted">Savings Rate:</span>
              <strong style={{ color: 'var(--ok)' }}>42.8%</strong>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '0.78rem' }}>
        <strong>Lifestyle Creep Index: {creepPct}%</strong> &middot; Out of your +{formatMoney(netIncrease)} monthly pay increase, <strong>{formatMoney(savingsIncrease)} ({wealthCapturePct}%)</strong> is captured directly into wealth-building vehicles (German World ETFs, Indian SIPs, Emergency reserve), while only {formatMoney(spendIncrease)} ({creepPct}%) expands living comfort.
      </div>
    </div>
  )
}
