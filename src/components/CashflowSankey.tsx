import { formatMoney } from '../lib/money'

interface CashflowSankeyProps {
  incomeCents: number
  fixedExpenseCents: number
  variableExpenseCents: number
  debtPaymentCents: number
  savingsCents: number
  investmentsCents: number
  onNodeClick?: (flowType: 'income' | 'fixed' | 'variable' | 'debt' | 'savings') => void
}

export function CashflowSankey({
  incomeCents,
  fixedExpenseCents,
  variableExpenseCents,
  debtPaymentCents,
  savingsCents,
  investmentsCents,
  onNodeClick,
}: CashflowSankeyProps) {
  const totalIn = Math.max(incomeCents, 1)
  const safeFixed = Math.max(fixedExpenseCents, 0)
  const safeVariable = Math.max(variableExpenseCents, 0)
  const safeDebt = Math.max(debtPaymentCents, 0)
  const safeInvest = Math.max(investmentsCents, 0)
  const safeSavings = Math.max(savingsCents - safeInvest, 0)

  // Node percentages
  const pFixed = Math.min(100, Math.round((safeFixed / totalIn) * 100))
  const pVariable = Math.min(100, Math.round((safeVariable / totalIn) * 100))
  const pDebt = Math.min(100, Math.round((safeDebt / totalIn) * 100))
  const pInvest = Math.min(100, Math.round((safeInvest / totalIn) * 100))
  const pSavings = Math.min(100, Math.max(0, 100 - pFixed - pVariable - pDebt - pInvest))

  return (
    <div className="sankey-card">
      <div className="sankey-head">
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>Cashflow Flow Distribution</h3>
          <p className="muted" style={{ fontSize: '0.78rem', margin: '2px 0 0' }}>
            Visual cash breakdown from monthly net income to obligations and wealth
          </p>
        </div>
      </div>

      <div className="sankey-diagram">
        {/* Source: Net Income */}
        <div className="sankey-col sankey-col--in">
          <div
            className="sankey-node sankey-node--in is-interactive"
            role="button"
            tabIndex={0}
            onClick={() => onNodeClick?.('income')}
            onKeyDown={(e) => e.key === 'Enter' && onNodeClick?.('income')}
            title="Click to view Income analysis"
          >
            <span className="sankey-node__tag">Net Income</span>
            <strong className="sankey-node__val">{formatMoney(incomeCents)}</strong>
            <span className="sankey-node__pct">100% Inflow · Inspect &rarr;</span>
          </div>
        </div>

        {/* Mid: SVG Connectors */}
        <div className="sankey-svg-wrap">
          <svg className="sankey-svg" viewBox="0 0 160 220" preserveAspectRatio="none">
            <defs>
              <linearGradient id="flow-fixed" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.6" />
              </linearGradient>
              <linearGradient id="flow-var" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.6" />
              </linearGradient>
              <linearGradient id="flow-debt" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.6" />
              </linearGradient>
              <linearGradient id="flow-invest" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.7" />
              </linearGradient>
            </defs>

            {/* Path 1: To Fixed Costs */}
            <path d="M 0,50 C 80,50 80,30 160,30" fill="none" stroke="url(#flow-fixed)" strokeWidth={Math.max(4, pFixed * 0.4)} />
            {/* Path 2: To Variable Costs */}
            <path d="M 0,80 C 80,80 80,80 160,80" fill="none" stroke="url(#flow-var)" strokeWidth={Math.max(4, pVariable * 0.4)} />
            {/* Path 3: To Debt (if any) */}
            {pDebt > 0 && (
              <path d="M 0,110 C 80,110 80,130 160,130" fill="none" stroke="url(#flow-debt)" strokeWidth={Math.max(3, pDebt * 0.35)} />
            )}
            {/* Path 4: To Investments / Savings */}
            <path d="M 0,140 C 80,140 80,185 160,185" fill="none" stroke="url(#flow-invest)" strokeWidth={Math.max(4, (pInvest + pSavings) * 0.45)} />
          </svg>
        </div>

        {/* Destination: Breakdown Nodes */}
        <div className="sankey-col sankey-col--out">
          <div
            className="sankey-node sankey-node--fixed is-interactive"
            role="button"
            tabIndex={0}
            onClick={() => onNodeClick?.('fixed')}
            onKeyDown={(e) => e.key === 'Enter' && onNodeClick?.('fixed')}
            title="Click to inspect fixed living obligations"
          >
            <div className="sankey-node__row">
              <span className="sankey-node__title">Fixed Living Costs</span>
              <strong className="sankey-node__val">{formatMoney(safeFixed)}</strong>
            </div>
            <div className="sankey-node__sub">Rent, Utilities, Insurances ({pFixed}%) · View ledger &rarr;</div>
          </div>

          <div
            className="sankey-node sankey-node--var is-interactive"
            role="button"
            tabIndex={0}
            onClick={() => onNodeClick?.('variable')}
            onKeyDown={(e) => e.key === 'Enter' && onNodeClick?.('variable')}
            title="Click to inspect variable lifestyle spending"
          >
            <div className="sankey-node__row">
              <span className="sankey-node__title">Variable Spend</span>
              <strong className="sankey-node__val">{formatMoney(safeVariable)}</strong>
            </div>
            <div className="sankey-node__sub">Groceries, Dining, Travel ({pVariable}%) · View ledger &rarr;</div>
          </div>

          {safeDebt > 0 && (
            <div
              className="sankey-node sankey-node--debt is-interactive"
              role="button"
              tabIndex={0}
              onClick={() => onNodeClick?.('debt')}
              onKeyDown={(e) => e.key === 'Enter' && onNodeClick?.('debt')}
              title="Click to view debt repayment schedules"
            >
              <div className="sankey-node__row">
                <span className="sankey-node__title">Debt Repayment</span>
                <strong className="sankey-node__val">{formatMoney(safeDebt)}</strong>
              </div>
              <div className="sankey-node__sub">Family Loan / Interest ({pDebt}%) · Manage debts &rarr;</div>
            </div>
          )}

          <div
            className="sankey-node sankey-node--savings is-interactive"
            role="button"
            tabIndex={0}
            onClick={() => onNodeClick?.('savings')}
            onKeyDown={(e) => e.key === 'Enter' && onNodeClick?.('savings')}
            title="Click to open savings & investment horizons"
          >
            <div className="sankey-node__row">
              <span className="sankey-node__title">Wealth &amp; Savings Buffer</span>
              <strong className="sankey-node__val" style={{ color: 'var(--ok)' }}>
                {formatMoney(safeSavings + safeInvest)}
              </strong>
            </div>
            <div className="sankey-node__sub">ETFs, Gold, Liquid Surplus ({pInvest + pSavings}%) · View goals &rarr;</div>
          </div>
        </div>
      </div>
    </div>
  )
}
