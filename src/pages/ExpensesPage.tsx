import { useMemo, useState } from 'react'
import { Badge, Empty, Field, Modal, Notice, Panel } from '../components/ui'
import { categoryFromName } from '../lib/categories'
import { isValidIsoDate } from '../lib/dates'
import { formatMoney, parseAmount } from '../lib/money'
import { categoryName, visibleTransactions } from '../lib/selectors'
import type { Category, Transaction, TxKind } from '../lib/types'
import { newTransaction, useStore } from '../state/store'

const KINDS: TxKind[] = ['expense', 'income', 'transfer', 'debt_payment', 'savings_contribution']

export function ExpensesPage() {
  const { state, saveTransaction, deleteTransaction, saveCategory, mergeCategory } = useStore()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'date' | 'amount' | 'category'>('date')
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [error, setError] = useState('')
  const [mergeFrom, setMergeFrom] = useState('')
  const [mergeTo, setMergeTo] = useState('')
  const rows = useMemo(() => {
    const list = visibleTransactions(state, { search })
    return [...list].sort((a, b) => {
      if (sort === 'amount') return b.amountCents - a.amountCents
      if (sort === 'category') return categoryName(state, a.categoryId).localeCompare(categoryName(state, b.categoryId))
      return b.date.localeCompare(a.date) || a.description.localeCompare(b.description)
    })
  }, [state, search, sort])

  function submit(form: FormData, existing: Transaction | null) {
    const date = String(form.get('date') ?? '')
    const amount = parseAmount(String(form.get('amount') ?? ''))
    const categoryId = String(form.get('categoryId') ?? '')
    const description = String(form.get('description') ?? '').trim()
    const kind = String(form.get('kind') ?? 'expense') as TxKind
    if (!isValidIsoDate(date)) return setError('Enter a real date.')
    if (amount === null || amount === 0) return setError('Enter a non-zero amount. Use a negative amount for a refund.')
    if (!categoryId) return setError('Choose a category.')
    if (!KINDS.includes(kind)) return setError('Choose a transaction type.')
    const base = existing ?? newTransaction({ date, amountCents: amount, categoryId, kind })
    saveTransaction({
      ...base,
      date,
      dayKnown: true,
      amountCents: amount,
      categoryId,
      kind,
      description: description || categoryName(state, categoryId),
      account: String(form.get('account') ?? ''),
      notes: String(form.get('notes') ?? ''),
      recurring: form.get('recurring') === 'on',
      origin: existing?.origin ?? 'actual',
      source: existing?.source ?? 'manual',
    }, !existing)
    setEditing(null)
    setError('')
  }

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <h1>Expenses</h1>
          <p>{rows.length} records in the current filters. Workbook lines keep their source cell.</p>
        </div>
        <button type="button" className="btn primary" onClick={() => { setError(''); setEditing(newTransaction({ date: state.filters.month === 'all' ? new Date().toISOString().slice(0, 10) : `${state.filters.month}-01`, amountCents: 0, categoryId: state.categories[0]?.id ?? '', kind: 'expense' })) }}>Add record</button>
      </header>
      <Panel>
        <div className="filters">
          <input placeholder="Search description, notes, category" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
            <option value="date">Sort by date</option>
            <option value="amount">Sort by amount</option>
            <option value="category">Sort by category</option>
          </select>
        </div>
        {rows.length === 0 ? <Empty title="Nothing matches" body="Adjust the filters or add a record. Missing categories are not filled in as zero." /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th className="num">Amount</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.dayKnown ? row.date : row.date.slice(0, 7)}{row.dayKnown ? '' : ' · day unknown'}</td>
                    <td>{row.description}{row.confidence === 'needs_review' ? <div><Badge tone="warn">Review</Badge></div> : null}<div className="muted">{row.sourceSheet ? `${row.sourceSheet} ${row.sourceCell}` : row.account}</div></td>
                    <td>{categoryName(state, row.categoryId)}</td>
                    <td>{labelKind(row.kind)}{row.origin === 'forecast' ? ' · plan' : ''}</td>
                    <td className="num">{formatMoney(row.amountCents)}</td>
                    <td className="actions"><button type="button" className="btn ghost" onClick={() => { setError(''); setEditing(row) }}>Edit</button><button type="button" className="btn ghost danger" onClick={() => deleteTransaction(row.id)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title="Categories">
        <CategoryEditor categories={state.categories} onSave={saveCategory} mergeFrom={mergeFrom} mergeTo={mergeTo} setMergeFrom={setMergeFrom} setMergeTo={setMergeTo} onMerge={() => mergeFrom && mergeTo && mergeFrom !== mergeTo && mergeCategory(mergeFrom, mergeTo)} />
      </Panel>
      {editing ? (
        <Modal title={editing.source === 'manual' && editing.amountCents === 0 ? 'Add record' : 'Edit record'} onClose={() => setEditing(null)}>
          <form className="form-grid" onSubmit={(event) => { event.preventDefault(); submit(new FormData(event.currentTarget), editing.amountCents === 0 && editing.source === 'manual' && !state.transactions.some((item) => item.id === editing.id) ? null : editing) }}>
            <Field label="Date"><input name="date" type="date" defaultValue={editing.date} required /></Field>
            <Field label="Amount (EUR)"><input name="amount" defaultValue={editing.amountCents ? (editing.amountCents / 100).toFixed(2) : ''} required /></Field>
            <Field label="Description"><input name="description" defaultValue={editing.description} /></Field>
            <Field label="Category">
              <select name="categoryId" defaultValue={editing.categoryId}>{state.categories.filter((category) => category.active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
            </Field>
            <Field label="Type">
              <select name="kind" defaultValue={editing.kind}>{KINDS.map((kind) => <option key={kind} value={kind}>{labelKind(kind)}</option>)}</select>
            </Field>
            <Field label="Account or payment method"><input name="account" defaultValue={editing.account} /></Field>
            <Field label="Notes" ><textarea name="notes" defaultValue={editing.notes} /></Field>
            <label className="check wide"><input type="checkbox" name="recurring" defaultChecked={editing.recurring} /> Mark as recurring</label>
            {error ? <Notice tone="warn">{error}</Notice> : null}
            <div className="actions wide"><button className="btn primary" type="submit">Save</button></div>
          </form>
        </Modal>
      ) : null}
    </div>
  )
}

function CategoryEditor({ categories, onSave, mergeFrom, mergeTo, setMergeFrom, setMergeTo, onMerge }: {
  categories: Category[]
  onSave: (category: Category) => void
  mergeFrom: string
  mergeTo: string
  setMergeFrom: (value: string) => void
  setMergeTo: (value: string) => void
  onMerge: () => void
}) {
  const [name, setName] = useState('')
  return (
    <div className="stack">
      <div className="filters">
        <input placeholder="New category name" value={name} onChange={(event) => setName(event.target.value)} />
        <button type="button" className="btn" onClick={() => { if (!name.trim()) return; onSave(categoryFromName(name.trim())); setName('') }}>Add category</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Group</th><th>Behaviour</th><th></th></tr></thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id}>
                <td><input defaultValue={category.name} onBlur={(event) => { if (event.target.value.trim() && event.target.value !== category.name) onSave({ ...category, name: event.target.value.trim(), renamed: true }) }} /></td>
                <td>{category.group}</td>
                <td><label className="check"><input type="checkbox" checked={category.fixed} onChange={(event) => onSave({ ...category, fixed: event.target.checked })} /> Fixed</label></td>
                <td><button type="button" className="btn ghost" onClick={() => onSave({ ...category, active: !category.active })}>{category.active ? 'Deactivate' : 'Activate'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="filters">
        <select value={mergeFrom} onChange={(event) => setMergeFrom(event.target.value)}><option value="">Merge from</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
        <select value={mergeTo} onChange={(event) => setMergeTo(event.target.value)}><option value="">Into</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
        <button type="button" className="btn" onClick={onMerge}>Merge</button>
      </div>
      <p className="muted">Merging moves records to the target category and deactivates the source. A later Excel upload still recognises the original workbook name.</p>
    </div>
  )
}

export function labelKind(kind: TxKind): string {
  if (kind === 'debt_payment') return 'Debt payment'
  if (kind === 'savings_contribution') return 'Savings transfer'
  return kind[0].toUpperCase() + kind.slice(1)
}
