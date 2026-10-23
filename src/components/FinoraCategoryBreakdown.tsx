import { formatMoney } from '../lib/money'
import { CategoryBadge } from './CategoryBadge'

export interface CategorySliceItem {
  id: string
  name: string
  value: number
  cents: number
}

interface FinoraCategoryBreakdownProps {
  slices: CategorySliceItem[]
  totalCents?: number
  onCategoryClick?: (id: string) => void
  selectedId?: string | null
}

export function FinoraCategoryBreakdown({
  slices,
  onCategoryClick,
  selectedId,
}: FinoraCategoryBreakdownProps) {
  const maxCents = Math.max(...slices.map((s) => s.cents), 1)

  return (
    <div className="finora-cat-card">
      <div className="finora-cat-card__head">
        <h2 className="finora-cat-card__title">Spending by Category</h2>
        <span className="finora-cat-card__period">Selected Period</span>
      </div>

      <div className="finora-cat-list">
        {slices.length === 0 ? (
          <p className="muted" style={{ fontSize: '0.82rem', padding: '16px 0', textAlign: 'center' }}>
            No expenses recorded for this period.
          </p>
        ) : (
          slices.slice(0, 5).map((slice) => {
            const pct = Math.min(100, Math.max(4, Math.round((slice.cents / maxCents) * 100)))
            const isSelected = selectedId === slice.id

            return (
              <div
                key={slice.id}
                className={`finora-cat-item ${isSelected ? 'is-selected' : ''}`}
                onClick={() => onCategoryClick?.(slice.id)}
                style={{ cursor: onCategoryClick ? 'pointer' : 'default' }}
              >
                <div className="finora-cat-item__top">
                  <CategoryBadge category={slice.name} label={slice.name} size="small" />
                  <span className="finora-cat-item__amount">{formatMoney(slice.cents)}</span>
                </div>
                <div className="finora-cat-item__track">
                  <div
                    className="finora-cat-item__bar"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
