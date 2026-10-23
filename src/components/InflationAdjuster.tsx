import { useState } from 'react'
import { formatMoney } from '../lib/money'
import { TrendingDown, ShieldAlert } from 'lucide-react'

export function InflationAdjuster() {
  const [inflationRate, setInflationRate] = useState(2.0) // 2.0% ECB benchmark
  const [baseMonthlySpend, setBaseMonthlySpend] = useState(1200) // €1,200/mo baseline

  // Compounded inflation factor: (1 + r)^years
  function futureCost(amount: number, years: number) {
    const r = inflationRate / 100
    return Math.round(amount * Math.pow(1 + r, years))
  }

  function purchasingPowerOf1000(years: number) {
    const r = inflationRate / 100
    return Math.round(1000 / Math.pow(1 + r, years))
  }

  const horizons = [
    { label: 'In 5 Years (2031)', years: 5 },
    { label: 'In 10 Years (2036)', years: 10 },
    { label: 'In 15 Years (2041)', years: 15 },
    { label: 'In 20 Years (2046)', years: 20 },
  ]

  return (
    <div className="sankey-card">
      <div className="sankey-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="kpi-icon kpi-icon--accent" style={{ width: 34, height: 34 }}>
            <TrendingDown size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>Inflation &amp; Purchasing Power Adjuster (ECB Benchmark)</h3>
            <p className="muted" style={{ fontSize: '0.76rem', margin: '2px 0 0' }}>
              Multi-year real purchasing power modeling (2027–2050) adjusted for inflation
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="muted" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Annual Inflation Rate:</span>
          <span className="badge tone-warn" style={{ fontSize: '0.85rem', fontWeight: 800 }}>{inflationRate.toFixed(1)}%</span>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem' }}>
            <span className="muted">Baseline Spend:</span>
            <input
              type="number"
              value={baseMonthlySpend}
              onChange={(e) => setBaseMonthlySpend(parseInt(e.target.value, 10) || 1200)}
              style={{ width: 80, padding: '2px 6px', fontSize: '0.78rem', borderRadius: 6, border: '1px solid var(--border)' }}
            />
            <span>€/mo</span>
          </label>
          <input
            type="range"
            min="0.5"
            max="8.0"
            step="0.1"
            value={inflationRate}
            onChange={(e) => setInflationRate(parseFloat(e.target.value) || 2.0)}
            style={{ flex: 1, minWidth: 140, accentColor: 'var(--amber)' }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 16 }}>
        {horizons.map((h) => {
          const needed = futureCost(baseMonthlySpend, h.years)
          const power = purchasingPowerOf1000(h.years)
          return (
            <div key={h.label} className="wealth-timeline-card">
              <span className="wealth-timeline-card__year">{h.label}</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--amber)', marginTop: 4 }}>
                {formatMoney(needed * 100)} / mo
              </div>
              <span className="muted" style={{ fontSize: '0.72rem' }}>
                Required to match €{baseMonthlySpend}/mo today
              </span>
              <div style={{ fontSize: '0.75rem', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                <span className="muted">Today's €1,000 worth:</span>
                <strong>€{power}</strong>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.78rem' }}>
        <ShieldAlert size={16} style={{ color: 'var(--amber)', flexShrink: 0 }} />
        <span>
          <strong>Wealth Preserving Target:</strong> To outpace {inflationRate}% inflation, your long-term equity SIPs (MSCI World at ~7% historical nominal return) yield an estimated <strong>{(7 - inflationRate).toFixed(1)}% real net return</strong>.
        </span>
      </div>
    </div>
  )
}
