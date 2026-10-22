import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { formatMoney } from '../lib/money'
import type { AppState } from '../lib/types'

export function Sparkline({ values, color = 'var(--green)' }: { values: number[]; color?: string }) {
  const finite = values.filter((value) => Number.isFinite(value))
  if (finite.length < 2) return null
  const width = 96
  const height = 32
  const min = Math.min(...finite)
  const max = Math.max(...finite)
  const span = max - min || 1
  const points = finite.map((value, index) => {
    const x = (index / (finite.length - 1)) * width
    const y = height - ((value - min) / span) * (height - 4) - 2
    return `${x},${y}`
  })
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export function PillTabs<T extends string>({ group, value, onChange, items }: { group: string; value: T; onChange: (id: T) => void; items: { id: T; label: string }[] }) {
  return (
    <div className="pills" role="tablist" aria-label={group}>
      {items.map((item) => (
        <button key={item.id} type="button" role="tab" aria-selected={item.id === value} className={item.id === value ? 'on' : ''} onClick={() => onChange(item.id)}>
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function SpendStack({ slices, onPick }: { slices: { id: string; label: string; cents: number; color: string }[]; onPick: (id: string) => void }) {
  const usable = slices.filter((slice) => slice.cents > 0)
  const total = usable.reduce((sum, slice) => sum + slice.cents, 0)
  if (!usable.length || total <= 0) return null
  return (
    <div className="spend-stack">
      <div className="spend-track">
        {usable.map((slice) => (
          <button key={slice.id || slice.label} type="button" className="spend-slice" style={{ width: `${Math.max(4, (slice.cents / total) * 100)}%`, background: slice.color }} title={`${slice.label} ${formatMoney(slice.cents)}`} onClick={() => slice.id && onPick(slice.id)} />
        ))}
      </div>
      <ul>
        {usable.map((slice) => (
          <li key={slice.id || slice.label}>
            <button type="button" onClick={() => slice.id && onPick(slice.id)}>
              <i style={{ background: slice.color }} />
              {slice.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

const PAGES = [
  ['dashboard', 'Dashboard', 'Income, spending, and where the money went'],
  ['income', 'Income', 'Gross, net, and estimated deductions'],
  ['expenses', 'Expenses', 'Search, edit, and categories'],
  ['budgets', 'Budgets', 'Spent against the plan'],
  ['savings', 'Savings', 'Goals and confirmed balances'],
  ['debts', 'Debts', 'Balances and repayment scenarios'],
  ['calendar', 'Calendar', 'Scheduled bills and income'],
  ['forecast', 'Forecast', '6 and 12 month scenarios'],
  ['reports', 'Reports', 'Trends, budgets, and comparisons'],
  ['data', 'Data', 'Upload Excel, export, and backup'],
] as const

export function CommandPalette({ open, onClose, state, onOpen }: { open: boolean; onClose: () => void; state: AppState; onOpen: (page: string, month?: string, categoryId?: string) => void }) {
  const [query, setQuery] = useState('')
  useEffect(() => {
    if (!open) setQuery('')
  }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const needle = query.trim().toLowerCase()
  const pages = PAGES.filter((page) => !needle || `${page[1]} ${page[2]}`.toLowerCase().includes(needle))
  const records = useMemo(() => {
    if (needle.length < 2) return []
    return state.transactions
      .filter((transaction) => `${transaction.description} ${transaction.notes}`.toLowerCase().includes(needle))
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8)
  }, [needle, state.transactions])

  if (!open) return null
  return (
    <div className="palette-back" onClick={onClose}>
      <div className="palette" role="dialog" aria-label="Search" onClick={(event) => event.stopPropagation()}>
        <input autoFocus placeholder="Jump to a page or search a record" value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="palette-list">
          {pages.map(([id, label, hint]) => (
            <button key={id} type="button" onClick={() => { onOpen(id); onClose() }}>
              <strong>{label}</strong>
              <span>{hint}</span>
            </button>
          ))}
          {records.map((transaction) => (
            <button key={transaction.id} type="button" onClick={() => { onOpen('expenses', transaction.date.slice(0, 7), transaction.categoryId); onClose() }}>
              <strong>{transaction.description || 'Untitled record'}</strong>
              <span>{transaction.date.slice(0, 7)} · {formatMoney(transaction.amountCents)}</span>
            </button>
          ))}
          {pages.length === 0 && records.length === 0 ? <p className="muted">No matching page or record.</p> : null}
        </div>
      </div>
    </div>
  )
}

export function KpiButton({ label, value, detail, tone = 'neutral', selected, spark, onClick, href }: { label: string; value: string; detail: string; tone?: 'good' | 'bad' | 'neutral'; selected?: boolean; spark?: number[]; onClick?: () => void; href?: string }) {
  const body = (
    <>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{detail}</small>
      {spark ? <Sparkline values={spark} color={tone === 'bad' ? 'var(--red)' : tone === 'good' ? 'var(--green)' : 'var(--blue)'} /> : null}
    </>
  )
  if (href) return <a className={`kpi tone-${tone}`} href={href}>{body}</a>
  return <button type="button" className={`kpi tone-${tone} ${selected ? 'selected' : ''}`} onClick={onClick}>{body}</button>
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" className={`chip ${active ? 'active' : ''}`} onClick={onClick}>{children}</button>
}
