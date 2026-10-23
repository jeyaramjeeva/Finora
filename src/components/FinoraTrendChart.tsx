import { useState } from 'react'
import { formatMoney } from '../lib/money'

export interface MonthTrendPoint {
  month: string
  label: string
  income: number | null
  expense: number | null
  savings: number | null
  rate: number | null
}

interface FinoraTrendChartProps {
  data: MonthTrendPoint[]
  netSavingsMargin: number | null
  averageExpenseCents: number | null
  activeMonth?: string
  onSelectMonth?: (month: string) => void
}

export function FinoraTrendChart({
  data,
  netSavingsMargin,
  averageExpenseCents,
  activeMonth,
  onSelectMonth,
}: FinoraTrendChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  // Take the most recent 6 months
  const recent = data.slice(-6)
  const maxVal = Math.max(
    ...recent.map((d) => Math.max(d.income ?? 0, d.expense ?? 0)),
    100
  )

  return (
    <div className="finora-chart-card">
      <div className="finora-chart-card__head">
        <div>
          <h2 className="finora-chart-card__title">Income vs. Expenses</h2>
          <p className="finora-chart-card__subtitle">6-Month Trend comparison</p>
        </div>
        <div className="finora-chart-card__legend">
          <span className="finora-legend-item">
            <span className="finora-legend-dot finora-legend-dot--income" /> Income
          </span>
          <span className="finora-legend-item">
            <span className="finora-legend-dot finora-legend-dot--expense" /> Expenses
          </span>
        </div>
      </div>

      {/* Visualizer Area */}
      <div className="finora-chart-visualizer">
        {recent.map((item, idx) => {
          const inc = item.income ?? 0
          const exp = item.expense ?? 0
          const incPct = Math.min(100, Math.max(6, Math.round((inc / maxVal) * 100)))
          const expPct = Math.min(100, Math.max(6, Math.round((exp / maxVal) * 100)))
          const isSelected = activeMonth ? item.month === activeMonth : idx === recent.length - 1
          const isHovered = hoveredIdx === idx

          return (
            <div
              key={item.month}
              className={`finora-bar-col ${isSelected ? 'is-selected' : ''}`}
              onClick={() => onSelectMonth?.(item.month)}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              title={`${item.label} (${item.month})\nIncome: ${formatMoney(Math.round(inc * 100))}\nExpenses: ${formatMoney(Math.round(exp * 100))}`}
            >
              {/* Tooltip on hover */}
              {isHovered && (
                <div className="finora-bar-tooltip">
                  <div className="finora-bar-tooltip__label">{item.label}</div>
                  <div className="finora-bar-tooltip__row">
                    <span style={{ color: '#10b981' }}>Income:</span>
                    <strong>{formatMoney(Math.round(inc * 100))}</strong>
                  </div>
                  <div className="finora-bar-tooltip__row">
                    <span style={{ color: '#f43f5e' }}>Spend:</span>
                    <strong>{formatMoney(Math.round(exp * 100))}</strong>
                  </div>
                </div>
              )}

              <div className="finora-bar-pair">
                {/* Income Bar */}
                <div
                  className="finora-bar finora-bar--income"
                  style={{ height: `${incPct}%` }}
                />
                {/* Expense Bar */}
                <div
                  className="finora-bar finora-bar--expense"
                  style={{ height: `${expPct}%` }}
                />
              </div>

              <span className={`finora-bar-label ${isSelected ? 'is-active-label' : ''}`}>
                {item.label}
              </span>
            </div>
          )
        })}
      </div>

      <div className="finora-chart-card__foot">
        <span>
          Net Savings Margin:{' '}
          <strong style={{ color: '#10b981' }}>
            {netSavingsMargin !== null ? `${netSavingsMargin.toFixed(0)}%` : '—'}
          </strong>
        </span>
        <span>
          Average Expense Rate:{' '}
          <strong>
            {averageExpenseCents !== null ? `${formatMoney(averageExpenseCents)} / mo` : '—'}
          </strong>
        </span>
      </div>
    </div>
  )
}
