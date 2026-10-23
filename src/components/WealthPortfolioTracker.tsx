import { useState } from 'react'
import { formatMoney } from '../lib/money'
import { TrendingUp, Coins, ShieldCheck } from 'lucide-react'

export function WealthPortfolioTracker() {
  const [monthlySipCents, setMonthlySipCents] = useState(80000) // €800/mo
  const [returnRate, setReturnRate] = useState(7) // 7% annualized return
  const [goldGrams, setGoldGrams] = useState(20) // 20 grams
  const goldPricePerGramEur = 78.5 // ~€78.50 / gram
  const goldValuationCents = Math.round(goldGrams * goldPricePerGramEur * 100)

  // Compound interest calculation
  function calculateFutureValue(monthlyCents: number, annualRatePct: number, years: number): number {
    const r = annualRatePct / 100 / 12
    const n = years * 12
    const monthlyEur = monthlyCents / 100
    // FV of an annuity formula: PMT * (((1 + r)^n - 1) / r)
    const fv = monthlyEur * ((Math.pow(1 + r, n) - 1) / r)
    return Math.round(fv * 100)
  }

  const fv10 = calculateFutureValue(monthlySipCents, returnRate, 10)
  const fv20 = calculateFutureValue(monthlySipCents, returnRate, 20)
  const fv30 = calculateFutureValue(monthlySipCents, returnRate, 30)

  // Coast FIRE: At €1,500/mo baseline living expenses (€18,000/yr), 4% rule target is €450,000
  const fireTargetCents = 45000000

  return (
    <div className="wealth-card">
      <div className="wealth-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="kpi-icon kpi-icon--positive" style={{ width: 34, height: 34 }}>
            <TrendingUp size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>Multi-Bucket Wealth &amp; Investment Portfolio</h3>
            <p className="muted" style={{ fontSize: '0.76rem', margin: '2px 0 0' }}>
              German World ETFs, Indian Mutual Funds, Gold reserves, and long-term compounding
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="status-pill ok">
            <ShieldCheck size={12} style={{ marginRight: 3, verticalAlign: 'middle' }} />
            Wealth Accumulation Stage
          </span>
        </div>
      </div>

      {/* 4 Asset Buckets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 16 }}>
        <div className="wealth-bucket">
          <span className="wealth-bucket__tag">German ETF SIP</span>
          <strong className="wealth-bucket__title">MSCI World / All-World</strong>
          <div className="wealth-bucket__alloc">Allocated: €500 / mo</div>
          <span className="muted" style={{ fontSize: '0.72rem' }}>Core retirement engine</span>
        </div>

        <div className="wealth-bucket">
          <span className="wealth-bucket__tag">Indian Equity SIP</span>
          <strong className="wealth-bucket__title">Nifty 50 / Flexicap</strong>
          <div className="wealth-bucket__alloc">Allocated: ₹25,000 / mo (~€276)</div>
          <span className="muted" style={{ fontSize: '0.72rem' }}>Emerging market compounding</span>
        </div>

        <div className="wealth-bucket">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="wealth-bucket__tag">Physical Gold</span>
            <Coins size={14} style={{ color: '#f59e0b' }} />
          </div>
          <strong className="wealth-bucket__title">{goldGrams}g Reserve</strong>
          <div className="wealth-bucket__alloc" style={{ color: '#f59e0b' }}>
            Valuation: {formatMoney(goldValuationCents)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span className="muted" style={{ fontSize: '0.7rem' }}>Grams:</span>
            <input
              type="number"
              min="0"
              value={goldGrams}
              onChange={(e) => setGoldGrams(parseInt(e.target.value, 10) || 0)}
              style={{ width: 45, padding: '1px 4px', fontSize: '0.72rem', borderRadius: 4, border: '1px solid var(--border)' }}
            />
          </div>
        </div>

        <div className="wealth-bucket">
          <span className="wealth-bucket__tag">Emergency Buffer</span>
          <strong className="wealth-bucket__title">Liquid Cash Reserve</strong>
          <div className="wealth-bucket__alloc" style={{ color: 'var(--ok)' }}>3 to 6 Months Target</div>
          <span className="muted" style={{ fontSize: '0.72rem' }}>Tagesgeld / overnight account</span>
        </div>
      </div>

      {/* Compound Interest Simulator */}
      <div style={{ marginTop: 20, padding: 18, borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0 }}>Compound Growth &amp; Coast FIRE Simulator</h4>
            <span className="muted" style={{ fontSize: '0.75rem' }}>Projected portfolio value over time at {returnRate}% annualized real return</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="muted" style={{ fontSize: '0.75rem' }}>Monthly Investment:</span>
              <strong style={{ color: 'var(--ok)' }}>{formatMoney(monthlySipCents)}</strong>
            </div>
            <select
              value={returnRate}
              onChange={(e) => setReturnRate(parseInt(e.target.value, 10))}
              style={{ padding: '3px 8px', fontSize: '0.78rem', borderRadius: 6, border: '1px solid var(--border)' }}
            >
              <option value="5">Conservative (5%)</option>
              <option value="7">Expected (7%)</option>
              <option value="9">Optimistic (9%)</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <input
            type="range"
            min="20000"
            max="250000"
            step="5000"
            value={monthlySipCents}
            onChange={(e) => setMonthlySipCents(parseInt(e.target.value, 10))}
            style={{ width: '100%', accentColor: 'var(--ok)' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 14 }}>
          <div className="wealth-timeline-card">
            <span className="wealth-timeline-card__year">In 10 Years</span>
            <div className="wealth-timeline-card__val">{formatMoney(fv10)}</div>
            <span className="muted" style={{ fontSize: '0.7rem' }}>Principal: {formatMoney(monthlySipCents * 12 * 10)}</span>
          </div>

          <div className="wealth-timeline-card">
            <span className="wealth-timeline-card__year">In 20 Years</span>
            <div className="wealth-timeline-card__val" style={{ color: 'var(--accent)' }}>{formatMoney(fv20)}</div>
            <span className="muted" style={{ fontSize: '0.7rem' }}>Principal: {formatMoney(monthlySipCents * 12 * 20)}</span>
          </div>

          <div className="wealth-timeline-card">
            <span className="wealth-timeline-card__year">In 30 Years</span>
            <div className="wealth-timeline-card__val" style={{ color: 'var(--ok)' }}>{formatMoney(fv30)}</div>
            <span className="muted" style={{ fontSize: '0.7rem' }}>Principal: {formatMoney(monthlySipCents * 12 * 30)}</span>
          </div>
        </div>

        <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
          <span className="muted">Coast FIRE Target (at €1,500/mo baseline &amp; 4% SWR):</span>
          <strong style={{ color: 'var(--ok)' }}>{formatMoney(fireTargetCents)}</strong>
        </div>
      </div>
    </div>
  )
}
