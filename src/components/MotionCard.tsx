import type { ReactNode, KeyboardEvent, CSSProperties } from 'react'

export function MotionCard({
  children,
  className = '',
  interactive = true,
  onClick,
  style,
}: {
  children: ReactNode
  className?: string
  delay?: number
  interactive?: boolean
  onClick?: () => void
  style?: CSSProperties
}) {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }

  return (
    <div
      className={`glass-card ${interactive ? 'glass-card--interactive' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={handleKeyDown}
      style={style}
    >
      <div className="glass-card__shine" aria-hidden />
      {children}
    </div>
  )
}
