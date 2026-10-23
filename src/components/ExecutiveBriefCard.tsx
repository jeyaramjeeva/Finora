import { useState } from 'react'
import { Badge, Panel } from './ui'
import { formatMoney, formatPercent } from '../lib/money'
import type { ExecutiveBrief } from '../lib/calc'

interface ExecutiveBriefCardProps {
  brief: ExecutiveBrief
  onCategoryClick?: (categoryName: string) => void
  onNavigate?: (tab: string) => void
}

export function ExecutiveBriefCard({ brief, onCategoryClick, onNavigate }: ExecutiveBriefCardProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <Panel
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
          <span>Financial Brief · Immediate Answers</span>
        </div>
      }
      className="executive-brief"
      extra={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Badge tone="ok">{brief.month}</Badge>
          <button
            type="button"
            className="btn ghost"
            style={{ fontSize: '0.78rem', padding: '4px 8px' }}
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? 'Expand answers' : 'Compact'}
          </button>
        </div>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
        {/* 1. Earned */}
        <div className="brief-card">
          <div className="brief-q">1. How much did I earn?</div>
          <div className="brief-val tone-good">{formatMoney(brief.earnedCents)}</div>
          <div className="brief-detail">
            {brief.earnedDeltaVsPrior !== null ? (
              <span className={brief.earnedDeltaVsPrior >= 0 ? 'muted' : 'muted'}>
                {brief.earnedDeltaVsPrior >= 0 ? '+' : ''}{formatMoney(brief.earnedDeltaVsPrior)} vs prior month.
              </span>
            ) : null}{' '}
            {brief.earnedNote}
          </div>
        </div>

        {/* 2. Spent */}
        <div className="brief-card">
          <div className="brief-q">2. How much did I spend?</div>
          <div className="brief-val">{formatMoney(brief.spentCents)}</div>
          <div className="brief-detail">
            {brief.spentDeltaVsPrior !== null ? (
              <span>
                {brief.spentDeltaVsPrior > 0 ? '+' : ''}{formatMoney(brief.spentDeltaVsPrior)} vs prior month.{' '}
              </span>
            ) : null}
            {brief.spentNote}
          </div>
        </div>

        {/* 3. Saved */}
        <div className="brief-card">
          <div className="brief-q">3. How much did I save?</div>
          <div className={`brief-val ${brief.savedCents !== null && brief.savedCents >= 0 ? 'tone-good' : 'tone-bad'}`}>
            {formatMoney(brief.savedCents)}{' '}
            {brief.savingsRate !== null ? (
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>({formatPercent(brief.savingsRate)})</span>
            ) : null}
          </div>
          <div className="brief-detail">{brief.savedNote}</div>
        </div>

        {/* 4. Available Cash */}
        <div className="brief-card">
          <div className="brief-q">4. Money available after obligations?</div>
          <div className="brief-val tone-good">{formatMoney(brief.availableCashCents)}</div>
          <div className="brief-detail">{brief.availableCashNote}</div>
        </div>

        {!collapsed && (
          <>
            {/* 5. Where does most money go */}
            <div
              className="brief-card"
              style={{ cursor: onCategoryClick && brief.topCategories[0] ? 'pointer' : 'default' }}
              onClick={() => brief.topCategories[0] && onCategoryClick?.(brief.topCategories[0].name)}
            >
              <div className="brief-q">5. Where does most of my money go?</div>
              <div className="brief-val" style={{ fontSize: '1.05rem' }}>
                {brief.topCategories[0] ? `${brief.topCategories[0].name} (${formatMoney(brief.topCategories[0].cents)})` : 'None'}
              </div>
              <div className="brief-detail">
                {brief.topCategoryNote}
              </div>
            </div>

            {/* 6. Spending vs planned */}
            <div className="brief-card">
              <div className="brief-q">6. Am I spending more than planned?</div>
              <div className="brief-val" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Badge tone={brief.spendingStatus === 'over' ? 'bad' : brief.spendingStatus === 'under' ? 'ok' : 'muted'}>
                  {brief.spendingStatus === 'over' ? 'Above baseline' : brief.spendingStatus === 'under' ? 'Below baseline' : brief.spendingStatus === 'on_track' ? 'On track' : 'No budget set'}
                </Badge>
              </div>
              <div className="brief-detail">{brief.spendingVsPlanNote}</div>
            </div>

            {/* 7. Debt remaining */}
            <div className="brief-card" style={{ cursor: 'pointer' }} onClick={() => onNavigate?.('debts')}>
              <div className="brief-q">7. How much debt do I still have?</div>
              <div className={`brief-val ${brief.totalDebtCents > 0 ? 'tone-bad' : 'tone-good'}`}>
                {formatMoney(brief.totalDebtCents)}
              </div>
              <div className="brief-detail">{brief.debtStatusNote}</div>
            </div>

            {/* 8. Realistic 6-12 month savings */}
            <div className="brief-card" style={{ cursor: 'pointer' }} onClick={() => onNavigate?.('forecast')}>
              <div className="brief-q">8. Realistic 6 to 12 month savings?</div>
              <div className="brief-val tone-good" style={{ fontSize: '1.05rem' }}>
                {formatMoney(brief.realisticSavings6mCents)} – {formatMoney(brief.realisticSavings12mCents)}
              </div>
              <div className="brief-detail">{brief.savingsOutlookNote}</div>
            </div>
          </>
        )}
      </div>
    </Panel>
  )
}
