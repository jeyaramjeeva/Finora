import type { ReactNode } from 'react'
import { formatMoney, formatPercent } from '../lib/money'

export function Panel({ title, extra, children, className = '' }: { title?: ReactNode; extra?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      {title ? (
        <header className="panel-head">
          <h2>{title}</h2>
          {extra}
        </header>
      ) : null}
      {children}
    </section>
  )
}

export function Stat({ label, value, detail, tone = 'neutral' }: { label: string; value: string; detail?: string; tone?: 'good' | 'bad' | 'neutral' }) {
  return (
    <article className={`stat tone-${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : <small className="spacer"> </small>}
    </article>
  )
}

export function MoneyText({ cents }: { cents: number | null }) {
  return <>{formatMoney(cents)}</>
}

export function PercentText({ value }: { value: number | null }) {
  return <>{formatPercent(value)}</>
}

export function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'ok' | 'warn' | 'bad' }) {
  return <span className={`badge tone-${tone}`}>{children}</span>
}

export function Progress({ value }: { value: number | null }) {
  const width = value === null ? 0 : Math.max(0, Math.min(value, 100))
  const tone = value === null ? 'none' : value >= 100 ? 'bad' : value >= 90 ? 'bad' : value >= 75 ? 'warn' : 'ok'
  return (
    <div className="progress" aria-hidden="true">
      <span className={`tone-${tone}`} style={{ width: `${width}%` }} />
    </div>
  )
}

export function Modal({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  const label = typeof title === 'string' ? title : undefined
  return (
    <div className="modal-back" role="presentation" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={label} onClick={(event) => event.stopPropagation()}>
        <header className="panel-head">
          <h2>{title}</h2>
          <button type="button" className="btn ghost" onClick={onClose}>Close</button>
        </header>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  )
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  return <div className={`notice tone-${tone}`}>{children}</div>
}
