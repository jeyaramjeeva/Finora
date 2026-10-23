import { useState } from 'react'
import { X, Search } from 'lucide-react'
import { formatMoney } from '../lib/money'
import { CategoryBadge } from './CategoryBadge'
import type { Transaction } from '../lib/types'

interface DrillDownDrawerProps {
  open: boolean
  title: string
  subtitle?: string
  transactions: Transaction[]
  onClose: () => void
  onDeleteTransaction?: (id: string) => void
}

export function DrillDownDrawer({
  open,
  title,
  subtitle,
  transactions,
  onClose,
  onDeleteTransaction,
}: DrillDownDrawerProps) {
  const [search, setSearch] = useState('')

  if (!open) return null

  const filtered = transactions.filter((t) => {
    if (!search.trim()) return true
    const term = search.toLowerCase()
    return (
      t.description.toLowerCase().includes(term) ||
      t.notes.toLowerCase().includes(term) ||
      t.categoryId.toLowerCase().includes(term) ||
      t.date.includes(term)
    )
  })

  const totalCents = filtered.reduce((s, t) => s + t.amountCents, 0)

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>{title}</h2>
            {subtitle && <p className="muted" style={{ fontSize: '0.82rem', margin: '2px 0 0' }}>{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close drawer">
            <X size={18} />
          </button>
        </header>

        <div className="drawer-search">
          <Search size={15} style={{ color: 'var(--muted)' }} />
          <input
            type="text"
            placeholder="Search records in this drawer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" className="btn ghost" style={{ padding: '2px 6px' }} onClick={() => setSearch('')}>
              ✕
            </button>
          )}
        </div>

        <div className="drawer-summary">
          <span>{filtered.length} matching transactions</span>
          <strong>Total: {formatMoney(totalCents)}</strong>
        </div>

        <div className="drawer-list">
          {filtered.length === 0 ? (
            <div className="drawer-empty">
              No transactions match &ldquo;{search}&rdquo;
            </div>
          ) : (
            filtered.map((tx) => {
              const isIncome = tx.kind === 'income'
              return (
                <div key={tx.id} className="drawer-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{tx.description}</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                        <CategoryBadge category={tx.categoryId} size="small" />
                        <span className="muted" style={{ fontSize: '0.75rem' }}>{tx.date}</span>
                      </div>
                      {tx.notes && <div className="muted" style={{ fontSize: '0.72rem', marginTop: 3 }}>{tx.notes}</div>}
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div
                        style={{
                          fontSize: '0.92rem',
                          fontWeight: 800,
                          color: isIncome ? 'var(--ok)' : 'var(--danger)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {isIncome ? '+ ' : '- '}{formatMoney(tx.amountCents)}
                      </div>
                      {onDeleteTransaction && (
                        <button
                          type="button"
                          className="btn ghost"
                          style={{ fontSize: '0.72rem', padding: '2px 4px', color: 'var(--danger)', marginTop: 4 }}
                          onClick={() => {
                            if (window.confirm(`Delete "${tx.description}"?`)) {
                              onDeleteTransaction(tx.id)
                            }
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </aside>
    </div>
  )
}
