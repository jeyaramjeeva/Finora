import { useMemo, useState } from 'react'
import { formatMoney } from '../lib/money'
import type { Transaction } from '../lib/types'

interface CalendarSpendingHeatmapProps {
  month: string
  transactions: Transaction[]
  onDayClick?: (dateStr: string) => void
}

export function CalendarSpendingHeatmap({
  month,
  transactions,
  onDayClick,
}: CalendarSpendingHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<{ day: number; cents: number; count: number } | null>(null)

  // Determine days in month
  const { daysInMonth, dayTotals } = useMemo(() => {
    const [yearStr, monthStr] = (month === 'all' ? '2026-02' : month).split('-')
    const y = parseInt(yearStr, 10)
    const m = parseInt(monthStr, 10)
    const totalDays = new Date(y, m, 0).getDate()

    const map = new Map<number, { cents: number; count: number }>()
    for (let d = 1; d <= totalDays; d++) {
      map.set(d, { cents: 0, count: 0 })
    }

    for (const t of transactions) {
      if (t.kind !== 'expense' && t.kind !== 'debt_payment') continue
      if (t.date.startsWith(month === 'all' ? '2026-02' : month)) {
        const dayNum = parseInt(t.date.slice(8, 10), 10)
        if (dayNum >= 1 && dayNum <= totalDays) {
          const curr = map.get(dayNum) ?? { cents: 0, count: 0 }
          curr.cents += t.amountCents
          curr.count += 1
          map.set(dayNum, curr)
        }
      }
    }

    return { daysInMonth: totalDays, dayTotals: map }
  }, [month, transactions])

  const maxDailyCents = useMemo(() => {
    let max = 1000
    for (const val of dayTotals.values()) {
      if (val.cents > max) max = val.cents
    }
    return max
  }, [dayTotals])

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  return (
    <div className="heatmap-card">
      <div className="heatmap-head">
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>Daily Spending Heatmap</h3>
          <p className="muted" style={{ fontSize: '0.78rem', margin: '2px 0 0' }}>
            Daily spend intensity for {month === 'all' ? 'Latest Month' : month}
          </p>
        </div>
        <div className="heatmap-legend">
          <span className="muted" style={{ fontSize: '0.72rem' }}>Zero</span>
          <span className="heatmap-cell heatmap-cell--0" />
          <span className="heatmap-cell heatmap-cell--1" />
          <span className="heatmap-cell heatmap-cell--2" />
          <span className="heatmap-cell heatmap-cell--3" />
          <span className="heatmap-cell heatmap-cell--4" />
          <span className="muted" style={{ fontSize: '0.72rem' }}>High</span>
        </div>
      </div>

      <div className="heatmap-grid">
        {daysArray.map((day) => {
          const data = dayTotals.get(day) ?? { cents: 0, count: 0 }
          const ratio = data.cents / maxDailyCents
          const level =
            data.cents === 0 ? 0 : ratio < 0.25 ? 1 : ratio < 0.5 ? 2 : ratio < 0.8 ? 3 : 4

          const dateStr = `${month === 'all' ? '2026-02' : month}-${String(day).padStart(2, '0')}`

          return (
            <div
              key={day}
              className={`heatmap-box heatmap-box--${level}`}
              onClick={() => onDayClick?.(dateStr)}
              onMouseEnter={() => setHoveredDay({ day, cents: data.cents, count: data.count })}
              onMouseLeave={() => setHoveredDay(null)}
              title={`${dateStr}: ${formatMoney(data.cents)} (${data.count} txs)`}
            >
              <span className="heatmap-day-num">{day}</span>
            </div>
          )
        })}
      </div>

      {hoveredDay && (
        <div className="heatmap-hover-info">
          <span>Day {hoveredDay.day}:</span>
          <strong>{formatMoney(hoveredDay.cents)}</strong>
          <span className="muted">({hoveredDay.count} transactions)</span>
        </div>
      )}
    </div>
  )
}
