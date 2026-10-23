import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  Wallet,
  Receipt,
  Target,
  TrendingUp,
  Landmark,
  Calendar,
  LineChart,
  BarChart3,
  Database,
  Search,
  ChevronLeft,
  ChevronRight,
  Menu,
  Sun,
  Moon,
  Upload,
  LogOut,
} from 'lucide-react'
import { CommandPalette } from './components/CommandPalette'
import { ExcelUploadModal } from './components/ExcelUploadModal'
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
import { LoginPage } from './pages/LoginPage'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'income', label: 'Income', icon: Wallet },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
  { id: 'budgets', label: 'Budgets', icon: Target },
  { id: 'savings', label: 'Savings', icon: TrendingUp },
  { id: 'debts', label: 'Debts', icon: Landmark },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'forecast', label: 'Forecast', icon: LineChart },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'data', label: 'Data & Sync', icon: Database },
] as const

export function App() {
  const [auth, setAuth] = useState<'checking' | 'in' | 'out'>('checking')

  useEffect(() => {
    let active = true
    fetch('/api/session', { credentials: 'same-origin' })
      .then((response) => response.json())
      .then((body: { ok?: boolean }) => {
        if (active) setAuth(body.ok ? 'in' : 'out')
      })
      .catch(() => {
        if (active) setAuth('out')
      })
    return () => {
      active = false
    }
  }, [])

  if (auth === 'checking') return <main className="login-screen"><p>Checking sign-in…</p></main>
  if (auth === 'out') return <LoginPage onSuccess={() => setAuth('in')} />

  return (
    <StoreProvider>
      <Shell onLogout={() => setAuth('out')} />
    </StoreProvider>
  )
}

function Shell({ onLogout }: { onLogout: () => void }) {
  const { state, ready, setFilters, update, commitImport } = useStore()
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
  const [uploadOpen, setUploadOpen] = useState(false)
  const [droppedFile, setDroppedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Sync data-theme attribute on document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.settings.theme)
  }, [state.settings.theme])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPalette((current) => !current)
      }
    }
    const onOpenUpload = () => {
      setDroppedFile(null)
      setUploadOpen(true)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('open-excel-upload', onOpenUpload)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('open-excel-upload', onOpenUpload)
    }
  }, [])

  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDragging(true)
      }
    }
    const onDragLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) {
        setIsDragging(false)
      }
    }
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer?.files?.[0]
      if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
        setDroppedFile(file)
        setUploadOpen(true)
      }
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  useEffect(() => {
    const sync = () => setPage(location.hash.replace('#', '') || 'dashboard')
    window.addEventListener('hashchange', sync)
    sync()
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  const handleExportBackup = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `finance-dashboard-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const toggleTheme = () => {
    update((current) => ({
      ...current,
      settings: {
        ...current.settings,
        theme: current.settings.theme === 'dark' ? 'light' : 'dark',
      },
    }))
  }

  if (!ready) return <div className="content"><p>Loading your financial records…</p></div>

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
      {isDragging ? (
        <div className="drag-overlay">
          <div className="drag-overlay-box">
            <h2 style={{ fontSize: '1.2rem', marginBottom: 6 }}>Drop Expense Tracker.xlsx here</h2>
            <p className="muted">Your dashboard will preview and sync all calculations immediately.</p>
          </div>
        </div>
      ) : null}

      <ExcelUploadModal
        open={uploadOpen}
        initialFile={droppedFile}
        onClose={() => { setUploadOpen(false); setDroppedFile(null) }}
        onCommit={(result, fileName, bytes) => {
          commitImport(result, { name: fileName, bytes })
          setToast(`Stored ${fileName} and replaced the workbook records (${result.stats.transactionCount}).`)
          setTimeout(() => setToast(null), 5500)
          location.hash = 'dashboard'
        }}
      />

      {toast ? (
        <div className="toast">
          <span style={{ color: 'var(--green)', fontWeight: 800 }}>✓</span>
          <span>{toast}</span>
          <button type="button" className="btn ghost" style={{ color: 'inherit', padding: '2px 6px' }} onClick={() => setToast(null)}>✕</button>
        </div>
      ) : null}

      <CommandPalette
        open={palette}
        onClose={() => setPalette(false)}
        onOpenExcel={() => { setDroppedFile(null); setUploadOpen(true) }}
        onToggleTheme={toggleTheme}
        theme={state.settings.theme}
        onExportBackup={handleExportBackup}
      />

      {open ? <button type="button" className="scrim" aria-label="Close menu" onClick={() => setOpen(false)} /> : null}

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark" style={{ width: 36, height: 36, maxWidth: 36, maxHeight: 36, overflow: 'hidden', flexShrink: 0 }}>
            <img
              src="/cashmetry-mark.png"
              alt="Cashmetry"
              width={28}
              height={28}
              style={{ width: '100%', height: '100%', maxWidth: 28, maxHeight: 28, objectFit: 'contain', display: 'block' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          </div>
          <div className="brand-copy">
            <strong>Cashmetry</strong>
            <small>Personal Finance Cockpit</small>
          </div>
          <button
            type="button"
            className="icon-btn collapse-btn"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setCollapsed((current) => !current)}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="nav">
          {NAV.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              className={page === id ? 'active' : ''}
              onClick={() => setOpen(false)}
              title={label}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span className="nav-label">{label}</span>
            </a>
          ))}
        </nav>

        <div className="sidebar-foot">
          <button
            type="button"
            className="btn ghost"
            style={{ width: '100%', justifyContent: 'flex-start' }}
            onClick={toggleTheme}
          >
            {state.settings.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span className="nav-label">{state.settings.theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <button
            type="button"
            className="btn ghost"
            style={{ width: '100%', justifyContent: 'flex-start' }}
            onClick={() => {
              void fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).finally(onLogout)
            }}
          >
            <LogOut size={16} />
            <span className="nav-label">Sign out</span>
          </button>
          <small>Signed in as Jeeva Jeyaram.</small>
        </div>
      </aside>

      <div className="shell">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn menu-btn"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>

          <button
            type="button"
            className="btn search-btn"
            onClick={() => setPalette(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <Search size={15} style={{ color: 'var(--muted)' }} />
            <span>Search</span>
            <kbd>Ctrl K</kbd>
          </button>

          <div className="chapter-switch" role="tablist" aria-label="Life stage">
            <button
              type="button"
              className={chapter === 'student' ? 'on' : ''}
              onClick={() => chooseChapter('student')}
            >
              Student life
            </button>
            <button
              type="button"
              className={chapter === 'employed' ? 'on' : ''}
              onClick={() => chooseChapter('employed')}
            >
              Full-time
            </button>
          </div>

          <strong>{periodLabel(state)}</strong>

          <select
            aria-label="Month"
            value={state.filters.month}
            onChange={(event) => setFilters({ month: event.target.value })}
          >
            <option value="all">{chapter === 'employed' ? 'First plan year' : 'All months'}</option>
            {monthChoices(state).map((month) => (
              <option key={month} value={month}>{month}</option>
            ))}
          </select>

          <select
            aria-label="Category"
            value={state.filters.categoryId}
            onChange={(event) => setFilters({ categoryId: event.target.value })}
          >
            <option value="all">All categories</option>
            {state.categories
              .filter((category) => category.active && (categoryIds.size === 0 || categoryIds.has(category.id)))
              .map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
          </select>

          <select
            aria-label="Type"
            value={state.filters.kind}
            onChange={(event) => setFilters({ kind: event.target.value as 'all' | TxKind })}
          >
            <option value="all">All types</option>
            {(['income', 'expense', 'transfer', 'debt_payment', 'savings_contribution'] as TxKind[]).map((kind) => (
              <option key={kind} value={kind}>{labelKind(kind)}</option>
            ))}
          </select>

          {chapter === 'student' ? (
            <select
              aria-label="Origin"
              value={state.filters.origin}
              onChange={(event) => setFilters({ origin: event.target.value as 'all' | 'actual' | 'forecast' })}
            >
              <option value="actual">Actual</option>
              <option value="forecast">Forecast</option>
              <option value="all">Actual and forecast</option>
            </select>
          ) : (
            <span className="badge">Plan only</span>
          )}

          <div className="grow">
            <button
              type="button"
              className="btn primary"
              onClick={() => { setDroppedFile(null); setUploadOpen(true) }}
            >
              <Upload size={16} />
              <span>Update from Excel</span>
            </button>
          </div>
        </header>

        <main className="content">
          <Page />
        </main>
      </div>
    </div>
  )
}
