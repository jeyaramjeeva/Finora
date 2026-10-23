import { Modal } from './ui'
import { Command } from 'lucide-react'

interface KeyboardShortcutsModalProps {
  open: boolean
  onClose: () => void
}

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  if (!open) return null

  const sections = [
    {
      title: 'Global Navigation',
      shortcuts: [
        { keys: ['G', 'D'], desc: 'Jump to Main Dashboard' },
        { keys: ['G', 'I'], desc: 'Jump to Income & Salary Analysis' },
        { keys: ['G', 'E'], desc: 'Jump to Expense Ledger' },
        { keys: ['G', 'B'], desc: 'Jump to Budgets' },
        { keys: ['G', 'S'], desc: 'Jump to Savings & Goals' },
        { keys: ['G', 'L'], desc: 'Jump to Debts & Repayments' },
        { keys: ['G', 'C'], desc: 'Jump to Calendar' },
        { keys: ['G', 'F'], desc: 'Jump to Forecasts' },
        { keys: ['G', 'R'], desc: 'Jump to Analytics & Reports' },
        { keys: ['G', 'X'], desc: 'Jump to Data & Sync' },
      ],
    },
    {
      title: 'Quick Actions',
      shortcuts: [
        { keys: ['Ctrl', 'K'], desc: 'Open Command Palette' },
        { keys: ['Ctrl', 'Shift', 'P'], desc: 'Toggle Stealth / Privacy Mode (Blur figures)' },
        { keys: ['N'], desc: 'Focus Quick Transaction input' },
        { keys: ['/'], desc: 'Focus Top Search bar' },
        { keys: ['?'], desc: 'Show this Keyboard Shortcuts cheat sheet' },
        { keys: ['Esc'], desc: 'Close any active modal or drawer' },
      ],
    },
  ]

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Command size={18} style={{ color: 'var(--ok)' }} />
          <span>Keyboard Shortcuts Suite</span>
        </div>
      }
      onClose={onClose}
    >
      <div className="stack" style={{ gap: 18 }}>
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          Speed up your workflow across Cashmetry using these global hotkeys:
        </p>

        {sections.map((section) => (
          <div key={section.title}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: 8 }}>
              {section.title}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {section.shortcuts.map((sc) => (
                <div
                  key={sc.desc}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: 'var(--surface-2)',
                    fontSize: '0.82rem',
                  }}
                >
                  <span style={{ color: 'var(--text)' }}>{sc.desc}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {sc.keys.map((k) => (
                      <kbd
                        key={k}
                        style={{
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                        }}
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
