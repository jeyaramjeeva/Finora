import { useState, type ChangeEvent } from 'react'
import { Badge, Modal, Notice } from './ui'
import { parseWorkbook } from '../lib/parseWorkbook'
import { sheetsFromArrayBuffer } from '../lib/xlsxIo'
import type { ImportResult } from '../lib/types'

interface ExcelUploadModalProps {
  open: boolean
  onClose: () => void
  onCommit: (result: ImportResult, fileName: string, bytes: ArrayBuffer) => void
  initialFile?: File | null
}

export function ExcelUploadModal({ open, onClose, onCommit, initialFile }: ExcelUploadModalProps) {
  const [file, setFile] = useState<File | null>(initialFile ?? null)
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null)
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-parse if initialFile was provided
  useState(() => {
    if (initialFile) {
      void handleFile(initialFile)
    }
  })

  async function handleFile(selected: File) {
    setFile(selected)
    setLoading(true)
    setError(null)
    try {
      const buffer = await selected.arrayBuffer()
      setBytes(buffer)
      const sheets = sheetsFromArrayBuffer(buffer)
      const asOf = new Date().toISOString().slice(0, 10)
      const parsed = parseWorkbook(sheets, asOf)
      setPreview(parsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read or parse this Excel file.')
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }

  function onFileInput(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]
    if (selected) {
      void handleFile(selected)
    }
  }

  if (!open) return null

  const diffs = preview?.reconciliation.filter((row) => row.differenceCents !== 0) ?? []
  const matches = (preview?.reconciliation.length ?? 0) - diffs.length

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: '#ffffff',
              border: '1px solid var(--border)',
              display: 'grid',
              placeItems: 'center',
              overflow: 'hidden',
              padding: 2,
              flexShrink: 0,
            }}
          >
            <img
              src="/cashmetry-mark.png"
              alt="Cashmetry"
              width={20}
              height={20}
              style={{ width: '100%', height: '100%', maxWidth: 20, maxHeight: 20, objectFit: 'contain', display: 'block' }}
            />
          </div>
          <span>Update Dashboard from Excel</span>
        </div>
      }
      onClose={onClose}
    >
      <div className="stack" style={{ gap: 14 }}>
        <p className="muted" style={{ fontSize: '0.9rem' }}>
          Select or drop your latest <strong>Expense Tracker.xlsx</strong>. The new file replaces the workbook stored in this browser. Records you added by hand stay. Tax ID, IBAN, and similar identifiers are left out of what is stored.
        </p>

        <label className="drop" style={{ cursor: 'pointer', padding: preview ? '16px' : '28px' }}>
          <strong>{file ? file.name : 'Click to select or drop Expense Tracker.xlsx'}</strong>
          <p className="muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>
            {file ? `${(file.size / 1024).toFixed(1)} KB · Click to change file` : '.xlsx or .xls file'}
          </p>
          <input type="file" accept=".xlsx,.xls" hidden onChange={onFileInput} />
        </label>

        {loading ? <p className="muted">Analyzing workbook structure, formulas, and transactions…</p> : null}
        {error ? <Notice tone="warn">{error}</Notice> : null}

        {preview ? (
          <div className="stack" style={{ gap: 12 }}>
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              <article className="stat" style={{ minHeight: 70, padding: 10 }}>
                <p>Transactions</p>
                <strong style={{ fontSize: '1.1rem' }}>{preview.stats.transactionCount}</strong>
                <small>{preview.stats.actualCount} actual records</small>
              </article>
              <article className="stat" style={{ minHeight: 70, padding: 10 }}>
                <p>Actual Period</p>
                <strong style={{ fontSize: '0.95rem' }}>{preview.stats.actualStart ?? '—'}</strong>
                <small>to {preview.stats.actualEnd ?? '—'}</small>
              </article>
              <article className="stat" style={{ minHeight: 70, padding: 10 }}>
                <p>Plan Rules</p>
                <strong style={{ fontSize: '1.1rem' }}>{preview.stats.forecastRuleCount}</strong>
                <small>Full-time rules from 2027</small>
              </article>
              <article className="stat" style={{ minHeight: 70, padding: 10 }}>
                <p>Debts & Goals</p>
                <strong style={{ fontSize: '1.1rem' }}>{preview.debts.length} debts</strong>
                <small>{preview.goals.length} investment goals</small>
              </article>
            </div>

            <div style={{ background: 'var(--surface-2)', padding: '10px 12px', borderRadius: 8, fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <strong>Reconciliation Check</strong>
                <span>{matches} months match sheet Spend row ({diffs.length} explained diffs)</span>
              </div>
              <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
                Semester fees (€1,680 each) and unsummed Feb 2026 DB tickets are tracked explicitly so nothing is double-counted or lost.
              </p>
            </div>

            {preview.issues.length ? (
              <details style={{ fontSize: '0.85rem', background: 'var(--surface-2)', padding: '8px 12px', borderRadius: 8 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                  {preview.issues.length} audit notes & discrepancies flagged (Click to review)
                </summary>
                <div style={{ maxHeight: 180, overflow: 'auto', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {preview.issues.map((issue, idx) => (
                    <div key={idx} style={{ fontSize: '0.8rem', borderBottom: '1px solid var(--line)', paddingBottom: 4 }}>
                      <Badge tone={issue.severity === 'warning' ? 'warn' : 'muted'}>{issue.severity}</Badge>{' '}
                      {issue.sheet ? <strong>[{issue.sheet}] </strong> : null}
                      {issue.message}
                    </div>
                  ))}
                </div>
              </details>
            ) : null}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
              <button type="button" className="btn ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={!bytes}
                onClick={() => {
                  if (bytes) onCommit(preview, file?.name ?? 'Expense Tracker.xlsx', bytes)
                  onClose()
                }}
              >
                Apply Import & Update Dashboard
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
