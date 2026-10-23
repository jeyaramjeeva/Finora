import { useState, type ChangeEvent } from 'react'
import { Modal } from './ui'
import { formatMoney } from '../lib/money'
import type { Transaction, TxKind } from '../lib/types'

interface BankCsvImporterProps {
  open: boolean
  onClose: () => void
  existingTransactions: Transaction[]
  onCommitImport: (transactions: Transaction[]) => void
}

type BankPreset = 'auto' | 'n26' | 'sparkasse' | 'dkb' | 'trade_republic' | 'revolut'

export function BankCsvImporter({
  open,
  onClose,
  existingTransactions,
  onCommitImport,
}: BankCsvImporterProps) {
  const [bank, setBank] = useState<BankPreset>('auto')
  const [parsedRows, setParsedRows] = useState<Transaction[]>([])
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  if (!open) return null

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setError(null)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const text = String(evt.target?.result || '')
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
        if (lines.length < 2) {
          throw new Error('CSV file has no data rows.')
        }

        // Detect delimiter (semicolon for German exports vs comma)
        const header = lines[0]
        const delimiter = header.includes(';') ? ';' : ','
        const headers = header.split(delimiter).map((h) => h.replace(/^["']|["']$/g, '').trim().toLowerCase())

        // Find date, payee, amount column indices
        let dateIdx = headers.findIndex((h) => /datum|date|buchungstag/i.test(h))
        let descIdx = headers.findIndex((h) => /begünst|empf|payee|description|verwendung|name|text/i.test(h))
        let amountIdx = headers.findIndex((h) => /betrag|amount|wert/i.test(h))

        if (dateIdx === -1) dateIdx = 0
        if (descIdx === -1) descIdx = 1
        if (amountIdx === -1) amountIdx = headers.length - 1

        const rows: Transaction[] = []
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(delimiter).map((c) => c.replace(/^["']|["']$/g, '').trim())
          if (cols.length < 2) continue

          const rawDate = cols[dateIdx] || ''
          const rawDesc = cols[descIdx] || 'Bank Transaction'
          const rawAmount = (cols[amountIdx] || '0').replace('€', '').replace(/\s/g, '').replace(',', '.')
          const amountNum = parseFloat(rawAmount)

          if (isNaN(amountNum) || amountNum === 0) continue

          // Format date to YYYY-MM-DD
          let formattedDate = new Date().toISOString().slice(0, 10)
          if (/^\d{2}\.\d{2}\.\d{4}$/.test(rawDate)) {
            const [d, m, y] = rawDate.split('.')
            formattedDate = `${y}-${m}-${d}`
          } else if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
            formattedDate = rawDate.slice(0, 10)
          }

          const isIncome = amountNum > 0
          const cents = Math.round(Math.abs(amountNum) * 100)

          // Categorize automatically by keyword
          let cat = isIncome ? 'salary' : 'other'
          const lower = rawDesc.toLowerCase()
          if (/rewe|edeka|aldi|lidl|supermarkt|penny|kaufland/i.test(lower)) cat = 'groceries'
          else if (/restaurant|mcdonald|subway|burger|pizza|cafe|bäcker/i.test(lower)) cat = 'food'
          else if (/miete|rent|vermieter|wohnung/i.test(lower)) cat = 'rent'
          else if (/db\b|bahn|bvg|ticket|uber|flixbus/i.test(lower)) cat = 'transport'
          else if (/netflix|spotify|prime|apple|google/i.test(lower)) cat = 'subscriptions'

          rows.push({
            id: `csv:${Date.now()}:${i}`,
            date: formattedDate,
            dayKnown: true,
            description: rawDesc,
            categoryId: cat,
            amountCents: cents,
            kind: (isIncome ? 'income' : 'expense') as TxKind,
            account: bank === 'auto' ? 'Bank Account' : bank.toUpperCase(),
            notes: `Imported from ${file.name}`,
            origin: 'actual',
            confidence: 'confirmed',
            source: 'csv',
            recurring: false,
          })
        }

        setParsedRows(rows)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not parse CSV.')
        setParsedRows([])
      }
    }
    reader.readAsText(file)
  }

  // Detect potential duplicates against existing transactions
  const dupes = parsedRows.filter((row) => {
    return existingTransactions.some(
      (ex) => ex.date === row.date && ex.amountCents === row.amountCents
    )
  })

  return (
    <Modal title="Import German Bank Statement (CSV)" onClose={onClose}>
      <div className="stack" style={{ gap: 14 }}>
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          Upload standard CSV exports from German banks (N26, Sparkasse, DKB, Deutsche Bank, Trade Republic, Revolut).
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem', fontWeight: 600 }}>
            <span>Bank Profile Preset</span>
            <select value={bank} onChange={(e) => setBank(e.target.value as any)} style={{ padding: '6px', borderRadius: 8, border: '1px solid var(--border)' }}>
              <option value="auto">Auto-detect columns</option>
              <option value="n26">N26 Bank</option>
              <option value="sparkasse">Sparkasse</option>
              <option value="dkb">DKB</option>
              <option value="trade_republic">Trade Republic</option>
              <option value="revolut">Revolut</option>
            </select>
          </label>
        </div>

        <label className="drop" style={{ cursor: 'pointer', padding: '20px' }}>
          <strong>{fileName ? fileName : 'Click to select bank statement (.csv)'}</strong>
          <span className="muted" style={{ fontSize: '0.78rem', display: 'block', marginTop: 4 }}>
            Comma or semicolon delimited German bank exports
          </span>
          <input type="file" accept=".csv,.txt" hidden onChange={handleFile} />
        </label>

        {error && <div className="notice warn">{error}</div>}

        {parsedRows.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: '0.84rem' }}>
              <strong>Preview: {parsedRows.length} transactions recognized</strong>
              {dupes.length > 0 && (
                <span style={{ color: 'var(--amber)', fontSize: '0.78rem', fontWeight: 600 }}>
                  ⚠️ {dupes.length} potential duplicate(s)
                </span>
              )}
            </div>

            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8, background: 'var(--surface-2)' }}>
              {parsedRows.slice(0, 8).map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span>{r.date} · {r.description}</span>
                  <strong style={{ color: r.kind === 'income' ? 'var(--ok)' : 'var(--text)' }}>
                    {r.kind === 'income' ? '+' : '-'} {formatMoney(r.amountCents)}
                  </strong>
                </div>
              ))}
              {parsedRows.length > 8 && <div className="muted" style={{ fontSize: '0.72rem', paddingTop: 4 }}>...and {parsedRows.length - 8} more</div>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  onCommitImport(parsedRows)
                  onClose()
                }}
              >
                Import {parsedRows.length} Transactions
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
