import { useState } from 'react'
import { formatMoney } from '../lib/money'
import { ArrowLeftRight } from 'lucide-react'

interface DualCurrencyRemittanceProps {
  initialEurToInrRate?: number
}

export function DualCurrencyRemittance({
  initialEurToInrRate = 90.5,
}: DualCurrencyRemittanceProps) {
  const [rate, setRate] = useState(initialEurToInrRate)
  const [eurVal, setEurVal] = useState('250')
  const [inrVal, setInrVal] = useState('')

  function handleEurChange(val: string) {
    setEurVal(val)
    const num = parseFloat(val) || 0
    setInrVal((num * rate).toFixed(0))
  }

  function handleInrChange(val: string) {
    setInrVal(val)
    const num = parseFloat(val) || 0
    setEurVal((num / rate).toFixed(2))
  }

  const commonTransfers = [
    { label: 'Indian Mutual Fund SIP', inr: 25000 },
    { label: 'Family Support Remittance', inr: 45000 },
    { label: 'India Trip Living Budget', inr: 100000 },
  ]

  return (
    <div className="remittance-card">
      <div className="remittance-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="kpi-icon kpi-icon--positive" style={{ width: 34, height: 34 }}>
            <ArrowLeftRight size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>Dual-Currency Remittance Tracker</h3>
            <p className="muted" style={{ fontSize: '0.76rem', margin: '2px 0 0' }}>
              EUR (€) / INR (₹) live conversion for Indian SIPs, remittances, and family support
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="muted" style={{ fontSize: '0.75rem', fontWeight: 600 }}>1 EUR =</span>
          <input
            type="number"
            step="0.1"
            value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value) || 90.5)}
            style={{ width: 65, padding: '3px 6px', fontSize: '0.8rem', borderRadius: 6, border: '1px solid var(--border)' }}
          />
          <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>INR</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 14 }}>
        {/* Converter inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--surface-2)', padding: 14, borderRadius: 12 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>Instant Currency Converter</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Euro (€)</label>
              <input
                type="number"
                value={eurVal}
                onChange={(e) => handleEurChange(e.target.value)}
                style={{ width: '100%', padding: '8px', fontSize: '0.9rem', fontWeight: 700, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}
              />
            </div>
            <span style={{ color: 'var(--muted)', marginTop: 14 }}>⇄</span>
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Rupee (₹)</label>
              <input
                type="number"
                value={inrVal || (parseFloat(eurVal || '0') * rate).toFixed(0)}
                onChange={(e) => handleInrChange(e.target.value)}
                style={{ width: '100%', padding: '8px', fontSize: '0.9rem', fontWeight: 700, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}
              />
            </div>
          </div>
        </div>

        {/* Common Recurring Remittances */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>Planned Recurring Commitments</div>
          {commonTransfers.map((item) => {
            const eurEquiv = item.inr / rate
            return (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  fontSize: '0.82rem',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{item.label}</div>
                  <div className="muted" style={{ fontSize: '0.72rem' }}>₹{item.inr.toLocaleString('en-IN')}</div>
                </div>
                <strong style={{ color: 'var(--accent)' }}>{formatMoney(Math.round(eurEquiv * 100))} / mo</strong>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
