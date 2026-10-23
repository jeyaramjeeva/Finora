import { useState, type FormEvent } from 'react'
import type { Category } from '../lib/types'

interface FinoraQuickAddProps {
  categories: Category[]
  onAddTransaction: (data: {
    description: string
    amountCents: number
    categoryId: string
    kind: 'expense' | 'income'
  }) => void
}

export function FinoraQuickAdd({ categories, onAddTransaction }: FinoraQuickAddProps) {
  const [description, setDescription] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? 'groceries')
  const [success, setSuccess] = useState(false)

  const activeCategories = categories.filter((c) => c.active).slice(0, 16)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = parseFloat(amountStr.replace(',', '.'))
    if (!description.trim() || isNaN(parsed) || parsed <= 0) return

    onAddTransaction({
      description: description.trim(),
      amountCents: Math.round(parsed * 100),
      categoryId: categoryId || 'other',
      kind: 'expense',
    })

    setDescription('')
    setAmountStr('')
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  return (
    <div className="finora-quickadd-card">
      <div className="finora-quickadd-card__head">
        <h2 className="finora-quickadd-card__title">Quick Add Transaction</h2>
        {success && <span className="finora-quickadd-success">✓ Saved to ledger</span>}
      </div>

      <form onSubmit={handleSubmit} className="finora-quickadd-form">
        <div>
          <label className="finora-field-label">Expense Name</label>
          <input
            id="quick-add-desc"
            required
            type="text"
            placeholder="e.g. Figma Subscription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="finora-input"
          />
        </div>

        <div className="finora-grid-2">
          <div>
            <label className="finora-field-label">Amount</label>
            <div className="finora-euro-wrap">
              <span className="finora-euro-symbol">€</span>
              <input
                id="quick-add-input"
                required
                type="number"
                step="0.01"
                min="0.01"
                placeholder="45.00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="finora-input finora-input--amount"
              />
            </div>
          </div>

          <div>
            <label className="finora-field-label">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="finora-input finora-select"
            >
              {activeCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button type="submit" className="finora-btn-submit">
          Record Transaction
        </button>
      </form>
    </div>
  )
}
