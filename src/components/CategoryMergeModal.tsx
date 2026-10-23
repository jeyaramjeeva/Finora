import { useState } from 'react'
import { Modal } from './ui'
import { GitMerge } from 'lucide-react'
import type { Category } from '../lib/types'

interface CategoryMergeModalProps {
  open: boolean
  categories: Category[]
  onClose: () => void
  onMerge: (sourceId: string, targetId: string) => void
}

export function CategoryMergeModal({
  open,
  categories,
  onClose,
  onMerge,
}: CategoryMergeModalProps) {
  const active = categories.filter((c) => c.active)
  const [sourceId, setSourceId] = useState(active[0]?.id || '')
  const [targetId, setTargetId] = useState(active[1]?.id || '')

  if (!open) return null

  function handleMerge() {
    if (!sourceId || !targetId || sourceId === targetId) return
    onMerge(sourceId, targetId)
    onClose()
  }

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GitMerge size={18} style={{ color: 'var(--ok)' }} />
          <span>Category Merging &amp; Reclassification</span>
        </div>
      }
      onClose={onClose}
    >
      <div className="stack" style={{ gap: 14 }}>
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          Consolidate duplicate or legacy categories. All transactions under the source category will be reassigned to the target category.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
              Source Category (To Merge)
            </label>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid var(--border)' }}
            >
              {active.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <span style={{ fontSize: '1.2rem', color: 'var(--muted)', marginTop: 16 }}>&rarr;</span>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
              Target Category (Keep)
            </label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid var(--border)' }}
            >
              {active.map((c) => (
                <option key={c.id} value={c.id} disabled={c.id === sourceId}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn primary"
            onClick={handleMerge}
            disabled={sourceId === targetId}
          >
            Merge Categories
          </button>
        </div>
      </div>
    </Modal>
  )
}
