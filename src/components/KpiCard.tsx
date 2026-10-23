import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { CountUp } from './CountUp'
import { MotionCard } from './MotionCard'
import { Sparkline } from './Sparkline'

export interface KpiCardProps {
  label: string
  value: number
  hint?: ReactNode
  icon: LucideIcon
  tone?: 'neutral' | 'positive' | 'negative' | 'accent'
  spark?: number[]
  trend?: number | null
  badge?: string
  selected?: boolean
  onClick?: () => void
  format?: (n: number) => string
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
  spark,
  trend,
  badge,
  selected,
  onClick,
  format,
}: KpiCardProps) {
  const content = (
    <>
      <div className="kpi-top">
        <div className={`kpi-icon kpi-icon--${tone}`}>
          <Icon size={18} strokeWidth={1.8} />
        </div>
        <div className="kpi-top-right">
          {badge && <span className={`status-pill ${tone === 'positive' ? 'ok' : ''}`}>{badge}</span>}
          {trend != null && Number.isFinite(trend) && (
            <span className={`trend ${trend >= 0 ? 'up' : 'down'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(0)}%
            </span>
          )}
        </div>
      </div>
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value tone-${tone}`}>
        <CountUp value={value} format={format} />
      </div>
      <div className="kpi-foot">
        <div className="kpi-hint">{hint}</div>
        {spark && spark.length > 1 && (
          <Sparkline
            values={spark}
            color={
              tone === 'negative'
                ? 'var(--danger)'
                : tone === 'positive'
                  ? 'var(--ok)'
                  : 'var(--accent)'
            }
          />
        )}
      </div>
    </>
  )

  return (
    <MotionCard
      className={`kpi-card ${selected ? 'is-selected' : ''} ${onClick ? 'is-clickable' : ''}`}
      onClick={onClick}
      interactive={Boolean(onClick)}
    >
      {content}
    </MotionCard>
  )
}
