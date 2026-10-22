import { useEffect, useState } from 'react'
import { CommandPalette } from './components/interactive'
import { activeChapter, chapterOf, scopeState } from './lib/chapter'
import { latestActualMonth } from './lib/createState'
import { StoreProvider, useStore } from './state/store'
import { monthChoices, periodLabel } from './lib/selectors'
import type { Chapter, TxKind } from './lib/types'
import { Dashboard } from './pages/Dashboard'
import { ExpensesPage, labelKind } from './pages/ExpensesPage'
import { IncomePage } from './pages/IncomePage'
import { BudgetsPage } from './pages/BudgetsPage'
import { CalendarPage, DebtsPage, ForecastPage, SavingsPage } from './pages/PlanPages'
import { DataPage, ReportsPage } from './pages/InsightPages'

const NAV = [
  ['dashboard', 'Dashboard'],
  ['income', 'Income'],
  ['expenses', 'Expenses'],
  ['budgets', 'Budgets'],
  ['savings', 'Savings'],
  ['debts', 'Debts'],
  ['calendar', 'Calendar'],
  ['forecast', 'Forecast'],
  ['reports', 'Reports'],
  ['data', 'Data'],
] as const

export function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}

function Shell() {
  const { state, ready, setFilters, update } = useStore()
  const view = scopeState(state)
  const chapter = activeChapter(state)
  const categoryIds = new Set([...view.transactions.map((transaction) => transaction.categoryId), ...view.recurring.map((rule) => rule.categoryId)])
  function chooseChapter(next: Chapter) {
    const month = next === 'employed'
      ? (state.assumptions.planStart ?? '2027-01')
      : latestActualMonth(state.transactions.filter((transaction) => chapterOf(transaction) === 'student'))
    setFilters({ chapter: next, month, categoryId: 'all', kind: 'all', origin: next === 'employed' ? 'forecast' : 'actual' })
  }
  const [page, setPage] = useState('dashboard')
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [palette, setPalette] = useState(false)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPalette((current) => !current)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => {
    const sync = () => setPage(location.hash.replace('#', '') || 'dashboard')
    window.addEventListener('hashchange', sync)
    sync()
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  if (!ready) return <div className="content"><p>Loading your records…</p></div>
  const Page = {
    dashboard: Dashboard,
    income: IncomePage,
    expenses: ExpensesPage,
    budgets: BudgetsPage,
    savings: SavingsPage,
    debts: DebtsPage,
    calendar: CalendarPage,
    forecast: ForecastPage,
    reports: ReportsPage,
    data: DataPage,
  }[page] ?? Dashboard

  return (
    <div className={`app ${collapsed ? 'is-collapsed' : ''}`}>
      <CommandPalette open={palette} onClose={() => setPalette(false)} state={view} onOpen={(next, month, categoryId) => { location.hash = next; if (month) setFilters({ month, categoryId: categoryId ?? 'all', kind: categoryId ? 'expense' : 'all' }) }} />
      {open ? <button type="button" className="scrim" aria-label="Close menu" onClick={() => setOpen(false)} /> : null}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">€</div>
          <div className="brand-copy"><strong>Finance</strong><br /><small>Local only</small></div>
          <button type="button" className="icon-btn collapse-btn" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed((current) => !current)}>{collapsed ? '›' : '‹'}</button>
        </div>
        <nav className="nav">
          {NAV.map(([id, label]) => <a key={id} href={`#${id}`} className={page === id ? 'active' : ''} onClick={() => setOpen(false)}><span className="nav-mark">{label.slice(0, 1)}</span><span className="nav-label">{label}</span></a>)}
        </nav>
        <div className="sidebar-foot">
          <button type="button" className="btn" onClick={() => update((current) => ({ ...current, settings: { ...current.settings, theme: current.settings.theme === 'dark' ? 'light' : 'dark' } }))}>{state.settings.theme === 'dark' ? 'Light mode' : 'Dark mode'}</button>
          <small>Records stay in this browser.</small>
        </div>
      </aside>
      <div className="shell">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">Menu</button>
          <button type="button" className="btn search-btn" onClick={() => setPalette(true)}>Search <kbd>Ctrl K</kbd></button>
          <div className="chapter-switch" role="tablist" aria-label="Life stage">
            <button type="button" className={chapter === 'student' ? 'on' : ''} onClick={() => chooseChapter('student')}>Student life</button>
            <button type="button" className={chapter === 'employed' ? 'on' : ''} onClick={() => chooseChapter('employed')}>Full-time</button>
          </div>
          <strong>{periodLabel(state)}</strong>
          <select aria-label="Month" value={state.filters.month} onChange={(event) => setFilters({ month: event.target.value })}>
            <option value="all">{chapter === 'employed' ? 'First plan year' : 'All months'}</option>
            {monthChoices(state).map((month) => <option key={month} value={month}>{month}</option>)}
          </select>
          <select aria-label="Category" value={state.filters.categoryId} onChange={(event) => setFilters({ categoryId: event.target.value })}>
            <option value="all">All categories</option>
            {state.categories.filter((category) => category.active && (categoryIds.size === 0 || categoryIds.has(category.id))).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <select aria-label="Type" value={state.filters.kind} onChange={(event) => setFilters({ kind: event.target.value as 'all' | TxKind })}>
            <option value="all">All types</option>
            {(['income', 'expense', 'transfer', 'debt_payment', 'savings_contribution'] as TxKind[]).map((kind) => <option key={kind} value={kind}>{labelKind(kind)}</option>)}
          </select>
          {chapter === 'student' ? (
            <select aria-label="Origin" value={state.filters.origin} onChange={(event) => setFilters({ origin: event.target.value as 'all' | 'actual' | 'forecast' })}>
              <option value="actual">Actual</option>
              <option value="forecast">Forecast</option>
              <option value="all">Actual and forecast</option>
            </select>
          ) : <span className="badge">Plan only</span>}
          <div className="grow"><a className="btn primary" href="#data">Update from Excel</a></div>
        </header>
        <main className="content"><Page /></main>
      </div>
    </div>
  )
}
