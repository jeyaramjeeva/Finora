import { useMemo, useState } from 'react'
import {
  Receipt,
  Wallet,
  Percent,
  Target,
  AlertTriangle,
  Download,
  PlusCircle,
  Search,
  Pencil,
  Trash2,
} from 'lucide-react'
import { Empty, Field, Modal, Notice, Panel } from '../components/ui'
import { KpiCard } from '../components/KpiCard'
import { CategoryBadge } from '../components/CategoryBadge'
import { categoryFromName } from '../lib/categories'
import { isValidIsoDate } from '../lib/dates'
import { formatMoney, parseAmount } from '../lib/money'
import { categoryName, visibleTransactions } from '../lib/selectors'
import { findDuplicateExpenses, type DuplicateExpenseGroup } from '../lib/duplicateExpenses'
import type { Category, Transaction, TxKind } from '../lib/types'
import { newTransaction, useStore } from '../state/store'
import { transactionsToCsv, workbookFromTransactions } from '../lib/xlsxIo'

const KINDS: TxKind[] = ['expense', 'income', 'transfer', 'debt_payment', 'savings_contribution']

export function ExpensesPage() {
  const { state: full, saveTransaction, deleteTransaction, saveCategory, mergeCategory } = useStore()
  const state = full

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'date' | 'amount' | 'category'>('date')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterKind, setFilterKind] = useState<string>('all')
  const [filterAccount, setFilterAccount] = useState<string>('all')
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')

  const [page, setPage] = useState<number>(1)
  const pageSize = 25

  const [editing, setEditing] = useState<Transaction | null>(null)
  const [error, setError] = useState('')
  const [mergeFrom, setMergeFrom] = useState('')
  const [mergeTo, setMergeTo] = useState('')
  const [showDuplicates, setShowDuplicates] = useState(false)

  // Duplicate expenses audit
  const duplicateGroups = useMemo(() => findDuplicateExpenses(state.transactions), [state.transactions])

  // Distinct accounts for dropdown
  const accounts = useMemo(() => {
    const set = new Set<string>()
    for (const t of state.transactions) {
      if (t.account && t.account.trim()) set.add(t.account.trim())
    }
    return [...set].sort()
  }, [state.transactions])

  // Filtered transactions
  const rows = useMemo(() => {
    let list = visibleTransactions(state, { search, from: fromDate || undefined, to: toDate || undefined })

    if (filterCategory !== 'all') {
      list = list.filter((t) => t.categoryId === filterCategory)
    }
    if (filterKind !== 'all') {
      list = list.filter((t) => t.kind === filterKind)
    }
    if (filterAccount !== 'all') {
      list = list.filter((t) => t.account === filterAccount)
    }

    return [...list].sort((a, b) => {
      if (sort === 'amount') return b.amountCents - a.amountCents
      if (sort === 'category') return categoryName(state, a.categoryId).localeCompare(categoryName(state, b.categoryId))
      return b.date.localeCompare(a.date) || a.description.localeCompare(b.description)
    })
  }, [state, search, sort, filterCategory, filterKind, filterAccount, fromDate, toDate])

  // Summary figures for filtered set
  const summary = useMemo(() => {
    const expenseRows = rows.filter((r) => r.kind === 'expense')
    const totalExpenseCents = expenseRows.reduce((sum, r) => sum + r.amountCents, 0)
    const avgCents = expenseRows.length ? Math.round(totalExpenseCents / expenseRows.length) : 0
    const maxCents = expenseRows.length ? Math.max(...expenseRows.map((r) => r.amountCents)) : 0
    return {
      count: rows.length,
      expenseCount: expenseRows.length,
      totalExpenseCents,
      avgCents,
      maxCents,
    }
  }, [rows])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return rows.slice(start, start + pageSize)
  }, [rows, page, pageSize])

  function download(filename: string, blob: Blob) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  function submit(form: FormData, existing: Transaction | null) {
    const date = String(form.get('date') ?? '')
    const amount = parseAmount(String(form.get('amount') ?? ''))
    const categoryId = String(form.get('categoryId') ?? '')
    const description = String(form.get('description') ?? '').trim()
    const kind = String(form.get('kind') ?? 'expense') as TxKind
    const account = String(form.get('account') ?? '').trim()
    const notes = String(form.get('notes') ?? '').trim()
    const recurring = Boolean(form.get('recurring'))

    if (!isValidIsoDate(date)) {
      setError('Please provide a valid date formatted as YYYY-MM-DD.')
      return
    }
    if (amount === null) {
      setError('Please provide a valid numeric currency amount.')
      return
    }
    if (!categoryId) {
      setError('Please select or assign a category.')
      return
    }

    const payload = existing
      ? {
          ...existing,
          date,
          amountCents: amount,
          categoryId,
          description,
          kind,
          account,
          notes,
          recurring,
          edited: true,
        }
      : newTransaction({
          date,
          amountCents: amount,
          categoryId,
          description,
          kind,
          account,
          notes,
          recurring,
        })

    saveTransaction(payload, !existing)
    setEditing(null)
    setError('')
  }

  function handleFilterToDuplicate(group: DuplicateExpenseGroup) {
    setFromDate(group.date)
    setToDate(group.date)
    setFilterCategory(group.categoryId)
    setShowDuplicates(false)
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <header className="page-head">
        <div>
          <h1>Expense &amp; Transaction Ledger</h1>
          <p>
            Complete chronological record of all living costs, student expenses, transfers, and repayments.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn ghost"
            onClick={() => download('transactions-export.csv', new Blob([transactionsToCsv(rows, (id) => categoryName(state, id))], { type: 'text/csv' }))}
          >
            <Download size={15} /> Export CSV
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={async () => {
              const buffer = await workbookFromTransactions(rows, (id) => categoryName(state, id))
              download('transactions-export.xlsx', new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
            }}
          >
            <Download size={15} /> Export Excel
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              setError('')
              setEditing(
                newTransaction({
                  date: state.filters.month === 'all' ? new Date().toISOString().slice(0, 10) : `${state.filters.month}-01`,
                  amountCents: 0,
                  categoryId: state.categories[0]?.id ?? '',
                  kind: 'expense',
                })
              )
            }}
          >
            <PlusCircle size={16} /> Add Transaction
          </button>
        </div>
      </header>

      {/* Duplicate Audit Alert Banner */}
      {duplicateGroups.length > 0 ? (
        <div className="quick-drop-banner" style={{ borderLeftColor: 'var(--amber)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={18} style={{ color: 'var(--amber)', flexShrink: 0 }} />
            <div>
              <strong>Duplicate Expense Audit:</strong> Found {duplicateGroups.length} potential duplicate clusters (same day + same category + same amount).
            </div>
          </div>
          <button
            type="button"
            className="btn ghost"
            style={{ fontSize: '0.8rem', padding: '4px 10px' }}
            onClick={() => setShowDuplicates((prev) => !prev)}
          >
            {showDuplicates ? 'Hide Clusters' : 'Inspect Clusters'}
          </button>
        </div>
      ) : null}

      {showDuplicates && duplicateGroups.length > 0 ? (
        <Panel title="Potential Duplicate Expense Clusters">
          <div className="list">
            {duplicateGroups.slice(0, 8).map((g, idx) => (
              <div key={idx} className="row-card" style={{ alignItems: 'center' }}>
                <div>
                  <strong>{categoryName(state, g.categoryId)} · {formatMoney(g.amountCents)}</strong>
                  <p className="muted" style={{ fontSize: '0.82rem' }}>
                    {g.date} ({g.count} transactions) — {g.descriptions.join(', ')}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn ghost"
                  style={{ fontSize: '0.78rem' }}
                  onClick={() => handleFilterToDuplicate(g)}
                >
                  Filter to date &amp; category
                </button>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {/* Summary KPI Cards with nasta-style KpiCard */}
      <section className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        <KpiCard
          label="Total Filtered Records"
          value={summary.count}
          format={(n) => `${Math.round(n)} records`}
          icon={Receipt}
          hint={`${summary.expenseCount} living expenses`}
        />
        <KpiCard
          label="Total Filtered Spend"
          value={summary.totalExpenseCents / 100}
          icon={Wallet}
          tone="negative"
          hint="Excludes account transfers &amp; deposits"
        />
        <KpiCard
          label="Average Expense"
          value={summary.avgCents / 100}
          icon={Percent}
          hint="Mean amount per expense transaction"
        />
        <KpiCard
          label="Largest Single Expense"
          value={summary.maxCents / 100}
          icon={Target}
          hint="Peak transaction in current view"
        />
      </section>

      {/* Advanced Filter Toolbar */}
      <Panel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="filters" style={{ alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 220px' }}>
              <input
                placeholder="Search description, memo, account..."
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1) }}
                style={{ width: '100%', paddingLeft: 30 }}
              />
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            </div>

            <select
              aria-label="Category filter"
              value={filterCategory}
              onChange={(e) => { setFilterCategory(e.target.value); setPage(1) }}
            >
              <option value="all">All Categories</option>
              {state.categories.filter((c) => c.active).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <select
              aria-label="Transaction type filter"
              value={filterKind}
              onChange={(e) => { setFilterKind(e.target.value); setPage(1) }}
            >
              <option value="all">All Types</option>
              {KINDS.map((k) => (
                <option key={k} value={k}>{labelKind(k)}</option>
              ))}
            </select>

            <select
              aria-label="Account filter"
              value={filterAccount}
              onChange={(e) => { setFilterAccount(e.target.value); setPage(1) }}
            >
              <option value="all">All Accounts</option>
              {accounts.map((acc) => (
                <option key={acc} value={acc}>{acc}</option>
              ))}
            </select>

            <select
              aria-label="Sort order"
              value={sort}
              onChange={(e) => setSort(e.target.value as 'date' | 'amount' | 'category')}
            >
              <option value="date">Sort by Date (Newest)</option>
              <option value="amount">Sort by Amount (Highest)</option>
              <option value="category">Sort by Category (A-Z)</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
            <span className="muted">Custom Date Range:</span>
            <input
              type="date"
              aria-label="From date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1) }}
              style={{ fontSize: '0.82rem', padding: '4px 8px' }}
            />
            <span className="muted">to</span>
            <input
              type="date"
              aria-label="To date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1) }}
              style={{ fontSize: '0.82rem', padding: '4px 8px' }}
            />
            {(fromDate || toDate || search || filterCategory !== 'all' || filterKind !== 'all' || filterAccount !== 'all') ? (
              <button
                type="button"
                className="btn ghost"
                style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                onClick={() => {
                  setSearch('')
                  setFilterCategory('all')
                  setFilterKind('all')
                  setFilterAccount('all')
                  setFromDate('')
                  setToDate('')
                  setPage(1)
                }}
              >
                Reset filters
              </button>
            ) : null}
          </div>
        </div>
      </Panel>

      {/* Transactions Table */}
      <Panel
        title={`Transactions (${rows.length})`}
        extra={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: '0.8rem' }}>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="btn ghost"
              disabled={page <= 1}
              style={{ padding: '2px 8px', fontSize: '0.78rem' }}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹ Prev
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={page >= totalPages}
              style={{ padding: '2px 8px', fontSize: '0.78rem' }}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next ›
            </button>
          </div>
        }
      >
        {rows.length === 0 ? (
          <Empty title="No matching transactions found" body="Try broadening your search term, category selection, or date range." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Account</th>
                  <th className="num">Amount</th>
                  <th>Status / Source</th>
                  <th style={{ width: 80 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((transaction) => {
                  const isExpense = transaction.kind === 'expense'
                  const isIncome = transaction.kind === 'income'
                  return (
                    <tr
                      key={transaction.id}
                      className="clickable"
                      onClick={() => { setError(''); setEditing(transaction) }}
                    >
                      <td>{transaction.date}</td>
                      <td>
                        <strong>{transaction.description || '—'}</strong>
                        {transaction.notes ? <p className="muted" style={{ fontSize: '0.75rem', margin: '2px 0 0' }}>{transaction.notes}</p> : null}
                      </td>
                      <td>
                        <CategoryBadge category={transaction.categoryId} label={categoryName(state, transaction.categoryId)} />
                      </td>
                      <td>
                        <span className="muted" style={{ fontSize: '0.78rem' }}>
                          {labelKind(transaction.kind)}
                        </span>
                      </td>
                      <td>
                        <span className="muted" style={{ fontSize: '0.78rem' }}>
                          {transaction.account || '—'}
                        </span>
                      </td>
                      <td className={`num ${isExpense ? 'tone-bad' : isIncome ? 'tone-good' : ''}`} style={{ fontWeight: 700 }}>
                        {isIncome ? '+' : isExpense ? '-' : ''}{formatMoney(transaction.amountCents)}
                      </td>
                      <td className="meta" style={{ fontSize: '0.78rem' }}>
                        {transaction.sourceSheet ? `${transaction.sourceSheet} ${transaction.sourceCell ?? ''}` : transaction.source}
                        {transaction.recurring ? ' · Recurring' : ''}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn ghost"
                            style={{ padding: '3px 6px' }}
                            title="Edit transaction"
                            onClick={() => { setError(''); setEditing(transaction) }}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn ghost danger"
                            style={{ padding: '3px 6px' }}
                            title="Delete transaction"
                            onClick={() => deleteTransaction(transaction.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Category Management Drawer */}
      <Panel title="Category Administration">
        <CategoryEditor
          categories={state.categories}
          onSave={saveCategory}
          mergeFrom={mergeFrom}
          mergeTo={mergeTo}
          setMergeFrom={setMergeFrom}
          setMergeTo={setMergeTo}
          onMerge={() => {
            if (mergeFrom && mergeTo && mergeFrom !== mergeTo) {
              mergeCategory(mergeFrom, mergeTo)
              setMergeFrom('')
              setMergeTo('')
            }
          }}
        />
      </Panel>

      {/* Transaction Edit/Create Modal */}
      {editing ? (
        <Modal
          title={state.transactions.some((item) => item.id === editing.id) ? 'Edit Transaction' : 'Record New Transaction'}
          onClose={() => setEditing(null)}
        >
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault()
              submit(
                new FormData(event.currentTarget),
                editing.amountCents === 0 && editing.source === 'manual' && !state.transactions.some((item) => item.id === editing.id) ? null : editing
              )
            }}
          >
            <Field label="Date">
              <input name="date" type="date" defaultValue={editing.date} required />
            </Field>
            <Field label="Amount (EUR)">
              <input name="amount" defaultValue={editing.amountCents ? (editing.amountCents / 100).toFixed(2) : ''} placeholder="0.00 (negative for refund)" required />
            </Field>
            <Field label="Description">
              <input name="description" defaultValue={editing.description} placeholder="e.g. Rewe cooking, BVG ticket, Rent" />
            </Field>
            <Field label="Category">
              <select name="categoryId" defaultValue={editing.categoryId}>
                {state.categories.filter((c) => c.active).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Transaction Type">
              <select name="kind" defaultValue={editing.kind}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>{labelKind(k)}</option>
                ))}
              </select>
            </Field>
            <Field label="Account / Payment Method">
              <input name="account" defaultValue={editing.account} placeholder="e.g. Revolut, Deutsche Bank, Scalable, Cash" />
            </Field>
            <Field label="Notes">
              <textarea name="notes" defaultValue={editing.notes} placeholder="Optional memo or reference notes" />
            </Field>
            <label className="check wide">
              <input type="checkbox" name="recurring" defaultChecked={editing.recurring} /> Mark as recurring monthly expense
            </label>
            {error ? <Notice tone="warn">{error}</Notice> : null}
            <div className="actions wide" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn primary" type="submit">Save Transaction</button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  )
}

function CategoryEditor({
  categories,
  onSave,
  mergeFrom,
  mergeTo,
  setMergeFrom,
  setMergeTo,
  onMerge,
}: {
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
    <div className="stack" style={{ gap: 12 }}>
      <div className="filters">
        <input placeholder="New category name" value={name} onChange={(event) => setName(event.target.value)} />
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (name.trim()) {
              onSave(categoryFromName(name))
              setName('')
            }
          }}
        >
          Add Category
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Nature</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id}>
                <td>
                  <input
                    defaultValue={category.name}
                    onBlur={(event) => onSave({ ...category, name: event.target.value.trim() || category.name, renamed: true })}
                    style={{ fontSize: '0.85rem', padding: '3px 6px' }}
                  />
                </td>
                <td>
                  <select
                    defaultValue={category.kind}
                    onChange={(event) => onSave({ ...category, kind: event.target.value as TxKind })}
                    style={{ fontSize: '0.82rem', padding: '2px 4px' }}
                  >
                    {KINDS.map((kind) => (
                      <option key={kind} value={kind}>{labelKind(kind)}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn ghost"
                    style={{ fontSize: '0.8rem', padding: '2px 6px' }}
                    onClick={() => onSave({ ...category, fixed: !category.fixed })}
                  >
                    {category.fixed ? 'Fixed' : 'Variable'}
                  </button>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn ghost"
                    style={{ fontSize: '0.8rem', padding: '2px 6px' }}
                    onClick={() => onSave({ ...category, active: !category.active })}
                  >
                    {category.active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn ghost danger"
                    style={{ fontSize: '0.8rem', padding: '2px 6px' }}
                    onClick={() => onSave({ ...category, active: false })}
                  >
                    Deactivate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="filters" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <span className="muted" style={{ fontSize: '0.85rem', alignSelf: 'center' }}>Merge Categories:</span>
        <select value={mergeFrom} onChange={(event) => setMergeFrom(event.target.value)}>
          <option value="">Source category to merge</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <span className="muted" style={{ alignSelf: 'center' }}>into</span>
        <select value={mergeTo} onChange={(event) => setMergeTo(event.target.value)}>
          <option value="">Destination category</option>
          {categories.filter((c) => c.id !== mergeFrom).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button
          type="button"
          className="btn"
          disabled={!mergeFrom || !mergeTo || mergeFrom === mergeTo}
          onClick={onMerge}
        >
          Execute Merge
        </button>
      </div>
    </div>
  )
}

export function labelKind(kind: TxKind): string {
  switch (kind) {
    case 'income':
      return 'Income'
    case 'expense':
      return 'Expense'
    case 'transfer':
      return 'Transfer'
    case 'debt_payment':
      return 'Debt payment'
    case 'savings_contribution':
      return 'Savings contribution'
  }
}
