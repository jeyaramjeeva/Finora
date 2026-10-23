import { formatMoney } from '../lib/money'
import { CategoryBadge } from './CategoryBadge'
import type { Transaction } from '../lib/types'

interface FinoraRecentTransactionsProps {
  transactions: Transaction[]
  onViewAll?: () => void
}

export function FinoraRecentTransactions({
  transactions,
  onViewAll,
}: FinoraRecentTransactionsProps) {
  const latest = transactions.slice(0, 6)

  return (
    <section className="finora-recent-card">
      <div className="finora-recent-card__head">
        <div>
          <h2 className="finora-recent-card__title">Recent Transactions</h2>
          <span className="finora-recent-card__subtitle">Showing latest ledger entries</span>
        </div>
        {onViewAll && (
          <button
            type="button"
            className="finora-link-btn"
            onClick={onViewAll}
          >
            View all expenses &rarr;
          </button>
        )}
      </div>

      <div className="finora-table-wrap">
        <table className="finora-table">
          <thead>
            <tr>
              <th style={{ width: '40%' }}>Description</th>
              <th style={{ width: '25%' }}>Category</th>
              <th style={{ width: '15%' }}>Date</th>
              <th style={{ width: '20%', textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {latest.length === 0 ? (
              <tr>
                <td colSpan={4} className="finora-table-empty">
                  No recent transactions recorded.
                </td>
              </tr>
            ) : (
              latest.map((tx) => {
                const isIncome = tx.kind === 'income'
                return (
                  <tr key={tx.id} className="finora-tr">
                    <td className="finora-td-desc">
                      <span
                        className={`finora-dot ${isIncome ? 'finora-dot--income' : 'finora-dot--expense'}`}
                      />
                      <span className="finora-desc-text" title={tx.description}>
                        {tx.description}
                      </span>
                    </td>
                    <td>
                      <CategoryBadge category={tx.categoryId} label={tx.description.length > 20 ? undefined : tx.categoryId} size="small" />
                    </td>
                    <td className="finora-td-date">{tx.date}</td>
                    <td className={`finora-td-amount ${isIncome ? 'is-income' : 'is-expense'}`}>
                      {isIncome ? '+ ' : '- '}{formatMoney(tx.amountCents)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
