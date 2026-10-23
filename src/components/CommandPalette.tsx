import { useEffect, useMemo, useState, useRef } from 'react'
import {
  LayoutDashboard,
  Wallet,
  Receipt,
  Target,
  Landmark,
  Calendar,
  TrendingUp,
  BarChart3,
  Database,
  FileSpreadsheet,
  Moon,
  Sun,
  Search,
  PlusCircle,
  Download,
} from 'lucide-react'

interface CommandItem {
  id: string
  label: string
  hint: string
  icon: typeof LayoutDashboard
  section: 'Navigation' | 'Actions'
  onSelect: () => void
}

export function CommandPalette({
  open,
  onClose,
  onOpenExcel,
  onToggleTheme,
  theme,
  onExportBackup,
}: {
  open: boolean
  onClose: () => void
  onOpenExcel: () => void
  onToggleTheme: () => void
  theme: 'light' | 'dark'
  onExportBackup?: () => void
}) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const items: CommandItem[] = useMemo(() => [
    {
      id: 'nav-dash',
      label: 'Main Dashboard',
      hint: 'Executive summary & KPI cockpit',
      icon: LayoutDashboard,
      section: 'Navigation',
      onSelect: () => {
        window.location.hash = 'dashboard'
        onClose()
      },
    },
    {
      id: 'nav-income',
      label: 'Income & Salary Analysis',
      hint: 'Gross, statutory deductions, net payslip trends',
      icon: Wallet,
      section: 'Navigation',
      onSelect: () => {
        window.location.hash = 'income'
        onClose()
      },
    },
    {
      id: 'nav-expenses',
      label: 'Expense Ledger',
      hint: 'Search, filter, edit & duplicate inspection',
      icon: Receipt,
      section: 'Navigation',
      onSelect: () => {
        window.location.hash = 'expenses'
        onClose()
      },
    },
    {
      id: 'nav-budgets',
      label: 'Monthly & Annual Budgets',
      hint: 'Spending limits, projected month-end & 75/90/100% alerts',
      icon: Target,
      section: 'Navigation',
      onSelect: () => {
        window.location.hash = 'budgets'
        onClose()
      },
    },
    {
      id: 'nav-savings',
      label: 'Savings & Financial Goals',
      hint: 'Emergency fund, compound projections & timeline',
      icon: TrendingUp,
      section: 'Navigation',
      onSelect: () => {
        window.location.hash = 'savings'
        onClose()
      },
    },
    {
      id: 'nav-debts',
      label: 'Debt Repayment Manager',
      hint: 'Avalanche vs Snowball, Anna & Appa loan amortization',
      icon: Landmark,
      section: 'Navigation',
      onSelect: () => {
        window.location.hash = 'debts'
        onClose()
      },
    },
    {
      id: 'nav-calendar',
      label: 'Upcoming Obligations Calendar',
      hint: '31-day recurring cash-flow & bills map',
      icon: Calendar,
      section: 'Navigation',
      onSelect: () => {
        window.location.hash = 'calendar'
        onClose()
      },
    },
    {
      id: 'nav-forecast',
      label: '6 & 12 Month Forecast',
      hint: 'Conservative, expected & optimistic scenarios',
      icon: TrendingUp,
      section: 'Navigation',
      onSelect: () => {
        window.location.hash = 'forecast'
        onClose()
      },
    },
    {
      id: 'nav-reports',
      label: 'Interactive Analytics & Reports',
      hint: 'Net worth balance sheet, category drilldowns & ratios',
      icon: BarChart3,
      section: 'Navigation',
      onSelect: () => {
        window.location.hash = 'reports'
        onClose()
      },
    },
    {
      id: 'nav-data',
      label: 'Raw Data & Audit Log',
      hint: 'Workbook trace cells, import diagnostics & backup',
      icon: Database,
      section: 'Navigation',
      onSelect: () => {
        window.location.hash = 'data'
        onClose()
      },
    },
    {
      id: 'act-excel',
      label: 'Update from Excel Spreadsheet',
      hint: 'Drop or select your updated Expense Tracker.xlsx',
      icon: FileSpreadsheet,
      section: 'Actions',
      onSelect: () => {
        onClose()
        onOpenExcel()
      },
    },
    {
      id: 'act-add-expense',
      label: 'Add Manual Expense / Transaction',
      hint: 'Record a new cash or card transaction',
      icon: PlusCircle,
      section: 'Actions',
      onSelect: () => {
        window.location.hash = 'expenses'
        onClose()
      },
    },
    {
      id: 'act-theme',
      label: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`,
      hint: 'Toggle UI color theme',
      icon: theme === 'dark' ? Sun : Moon,
      section: 'Actions',
      onSelect: () => {
        onToggleTheme()
        onClose()
      },
    },
    ...(onExportBackup
      ? [
          {
            id: 'act-export',
            label: 'Export Dashboard JSON Backup',
            hint: 'Download full persistent state as JSON',
            icon: Download,
            section: 'Actions' as const,
            onSelect: () => {
              onExportBackup()
              onClose()
            },
          },
        ]
      : []),
  ], [theme, onClose, onOpenExcel, onToggleTheme, onExportBackup])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (item) => item.label.toLowerCase().includes(q) || item.hint.toLowerCase().includes(q)
    )
  }, [items, query])

  useEffect(() => {
    setSelectedIndex(0)
  }, [filtered])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const selected = filtered[selectedIndex]
        if (selected) selected.onSelect()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, filtered, selectedIndex, onClose])

  if (!open) return null

  return (
    <div className="cmd-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Command Palette">
      <div className="cmd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cmd-header">
          <Search size={18} className="cmd-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="cmd-input"
            placeholder="Type a command or jump to page... (Esc to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="cmd-badge">ESC</kbd>
        </div>
        <div className="cmd-list" role="listbox">
          {filtered.length === 0 ? (
            <div className="cmd-empty">No matching commands found for &ldquo;{query}&rdquo;</div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon
              const isSelected = idx === selectedIndex
              return (
                <div
                  key={item.id}
                  role="option"
                  aria-selected={isSelected}
                  className={`cmd-item ${isSelected ? 'is-active' : ''}`}
                  onClick={() => item.onSelect()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="cmd-item-icon">
                    <Icon size={16} />
                  </div>
                  <div className="cmd-item-content">
                    <div className="cmd-item-title">{item.label}</div>
                    <div className="cmd-item-hint">{item.hint}</div>
                  </div>
                  <span className="cmd-item-tag">{item.section}</span>
                </div>
              )
            })
          )}
        </div>
        <div className="cmd-footer">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <img
              src="/cashmetry-mark.png"
              alt=""
              width={14}
              height={14}
              style={{ width: 14, height: 14, maxWidth: 14, maxHeight: 14, borderRadius: 3, objectFit: 'contain', display: 'inline-block' }}
            />
            <b>Cashmetry</b>
          </span>
          <span>Use <b>↑</b> <b>↓</b> to navigate</span>
          <span><b>↵</b> to select</span>
          <span><b>Esc</b> to close</span>
        </div>
      </div>
    </div>
  )
}
