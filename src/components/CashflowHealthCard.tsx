import {
  TrendingUp,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { formatMoney, formatPercent } from '../lib/money'
import { MotionCard } from './MotionCard'

interface CashflowHealthCardProps {
  incomeCents: number
  expenseCents: number
  savingsCents: number
  savingsRate: number | null
  budgetCents?: number | null
  periodLabel?: string
}

export function CashflowHealthCard({
  incomeCents,
  expenseCents,
  savingsCents,
  savingsRate,
  budgetCents,
  periodLabel = 'Current Period',
}: CashflowHealthCardProps) {
  const expenseRatio = incomeCents > 0 ? Math.min(100, Math.round((expenseCents / incomeCents) * 100)) : expenseCents > 0 ? 100 : 0
  const isSurplus = savingsCents >= 0

  // Budget calculations
  const budget = budgetCents && budgetCents > 0 ? budgetCents : 0
  const budgetPercent = budget > 0 ? Math.round((expenseCents / budget) * 100) : 0
  const budgetRemaining = budget > 0 ? budget - expenseCents : 0
  const isOverBudget = budget > 0 && expenseCents > budget
  const isNearBudget = budget > 0 && !isOverBudget && budgetPercent >= 80

  return (
    <div className="grid-2" style={{ gap: 14 }}>
      {/* 1. Cashflow Health Balance Card */}
      <MotionCard className="chart-chrome" interactive={false}>
        <div className="chart-chrome__head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="kpi-icon kpi-icon--positive" style={{ width: 34, height: 34 }}>
              <TrendingUp size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0 }}>Cashflow Health</h3>
              <p className="chart-chrome__hint" style={{ margin: 0 }}>Income vs. living expenses · {periodLabel}</p>
            </div>
          </div>
          {savingsRate !== null && incomeCents > 0 && (
            <span className="status-pill ok">
              {formatPercent(savingsRate)} Saved
            </span>
          )}
        </div>

        <div className="stack" style={{ gap: 12, marginTop: 8 }}>
          {/* Income Bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4, fontWeight: 600 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--muted)' }}>
                <ArrowUpRight size={14} style={{ color: 'var(--ok)' }} /> Net Income
              </span>
              <span style={{ color: 'var(--ok)', fontWeight: 700 }}>{formatMoney(incomeCents)}</span>
            </div>
            <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: incomeCents > 0 ? '100%' : '0%',
                  background: 'var(--ok)',
                  borderRadius: 99,
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
          </div>

          {/* Expenses Bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4, fontWeight: 600 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--muted)' }}>
                <ArrowDownRight size={14} style={{ color: 'var(--danger)' }} /> Living Expenses ({expenseRatio}% of income)
              </span>
              <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{formatMoney(expenseCents)}</span>
            </div>
            <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${expenseRatio}%`,
                  background: 'var(--danger)',
                  borderRadius: 99,
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
          </div>

          {/* Net Buffer Summary */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
            <span className="muted" style={{ fontSize: '0.84rem', fontWeight: 600 }}>Net Period Buffer</span>
            <span
              style={{
                fontSize: '1.15rem',
                fontWeight: 800,
                color: isSurplus ? 'var(--ok)' : 'var(--danger)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {isSurplus ? '+' : ''}{formatMoney(savingsCents)}
            </span>
          </div>
        </div>
      </MotionCard>

      {/* 2. Monthly Budget Progress Meter */}
      <MotionCard className="chart-chrome" interactive={false}>
        <div className="chart-chrome__head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              className={`kpi-icon ${isOverBudget ? 'kpi-icon--negative' : isNearBudget ? 'kpi-icon--accent' : 'kpi-icon--positive'}`}
              style={{ width: 34, height: 34 }}
            >
              <Target size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0 }}>Budget Health Meter</h3>
              <p className="chart-chrome__hint" style={{ margin: 0 }}>
                {budget > 0 ? 'Active category spending limit' : 'Configured targets'}
              </p>
            </div>
          </div>
          {budget > 0 ? (
            <span className={`status-pill ${isOverBudget ? '' : 'ok'}`} style={isOverBudget ? { borderColor: 'var(--danger)', color: 'var(--danger)' } : {}}>
              {isOverBudget ? 'Over Budget' : `${budgetPercent}% Used`}
            </span>
          ) : (
            <span className="status-pill">No Limit</span>
          )}
        </div>

        {budget > 0 ? (
          <div className="stack" style={{ gap: 10, marginTop: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '1.45rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {formatMoney(expenseCents)}
              </span>
              <span className="muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                of {formatMoney(budget)} allocated limit
              </span>
            </div>

            {/* Gauge progress bar */}
            <div style={{ height: 10, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden', padding: 1, border: '1px solid var(--border)' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, budgetPercent)}%`,
                  background: isOverBudget ? 'var(--danger)' : isNearBudget ? 'var(--warn)' : 'var(--ok)',
                  borderRadius: 99,
                  transition: 'width 0.5s ease',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', paddingTop: 2 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--muted)' }}>
                {isOverBudget ? (
                  <>
                    <AlertTriangle size={14} style={{ color: 'var(--danger)' }} /> Exceeded limit by
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} style={{ color: 'var(--ok)' }} /> Buffer remaining
                  </>
                )}
              </span>
              <span
                style={{
                  fontWeight: 800,
                  color: isOverBudget ? 'var(--danger)' : 'var(--ok)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatMoney(Math.abs(budgetRemaining))}
              </span>
            </div>
          </div>
        ) : (
          <div style={{ padding: '18px 0', textAlign: 'center' }}>
            <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
              Set monthly category budgets in the Budgets section to enable automated spending threshold gauges.
            </p>
          </div>
        )}
      </MotionCard>
    </div>
  )
}
