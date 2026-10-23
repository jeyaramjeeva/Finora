import { useMemo } from 'react'
import { formatMoney } from '../lib/money'
import { CalendarClock } from 'lucide-react'
import type { Transaction } from '../lib/types'

interface SubscriptionDetectorProps {
  transactions: Transaction[]
}

interface DetectedSub {
  name: string
  amountCents: number
  annualCostCents: number
  count: number
  lastDate: string
}

export function SubscriptionDetector({ transactions }: SubscriptionDetectorProps) {
  const subscriptions = useMemo(() => {
    // Group expenses by similar descriptions
    const map = new Map<string, { totalCents: number; count: number; amounts: number[]; lastDate: string }>()

    for (const t of transactions) {
      if (t.kind !== 'expense') continue
      const desc = t.description.trim()
      if (!desc) continue

      const key = desc.toLowerCase()
      const existing = map.get(key) ?? { totalCents: 0, count: 0, amounts: [], lastDate: t.date }
      existing.totalCents += t.amountCents
      existing.count += 1
      existing.amounts.push(t.amountCents)
      if (t.date > existing.lastDate) existing.lastDate = t.date
      map.set(key, existing)
    }

    const detected: DetectedSub[] = []
    for (const [key, val] of map.entries()) {
      if (val.count >= 2 || /netflix|spotify|prime|apple|icloud|gym|fitness|mobile|telekom/i.test(key)) {
        const avg = Math.round(val.totalCents / val.count)
        detected.push({
          name: key.charAt(0).toUpperCase() + key.slice(1),
          amountCents: avg,
          annualCostCents: avg * 12,
          count: val.count,
          lastDate: val.lastDate,
        })
      }
    }

    return detected.sort((a, b) => b.annualCostCents - a.annualCostCents)
  }, [transactions])

  const totalAnnualCents = subscriptions.reduce((s, sub) => s + sub.annualCostCents, 0)
  const totalMonthlyCents = Math.round(totalAnnualCents / 12)

  return (
    <div className="sub-detector-card">
      <div className="sub-detector-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="kpi-icon kpi-icon--accent" style={{ width: 34, height: 34 }}>
            <CalendarClock size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>Subscription &amp; Recurring Leak Detector</h3>
            <p className="muted" style={{ fontSize: '0.76rem', margin: '2px 0 0' }}>
              Identifies repeating debits and calculates cumulative annual cost
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div className="muted" style={{ fontSize: '0.72rem', fontWeight: 600 }}>Total Annualized Cost</div>
          <strong style={{ fontSize: '1.15rem', color: 'var(--danger)' }}>{formatMoney(totalAnnualCents)} / yr</strong>
          <div className="muted" style={{ fontSize: '0.7rem' }}>~{formatMoney(totalMonthlyCents)} / month</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
        {subscriptions.length === 0 ? (
          <p className="muted" style={{ fontSize: '0.82rem', padding: '16px 0', textAlign: 'center' }}>
            No repeating monthly subscriptions detected yet.
          </p>
        ) : (
          subscriptions.slice(0, 6).map((sub) => (
            <div
              key={sub.name}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                fontSize: '0.84rem',
              }}
            >
              <div>
                <strong style={{ display: 'block', color: 'var(--text)' }}>{sub.name}</strong>
                <span className="muted" style={{ fontSize: '0.74rem' }}>
                  {formatMoney(sub.amountCents)} / mo · billed {sub.count} times (last: {sub.lastDate})
                </span>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatMoney(sub.annualCostCents)}
                </span>
                <span className="muted" style={{ fontSize: '0.72rem', display: 'block' }}>per year</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
