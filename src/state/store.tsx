import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createState, isAppState, uid } from '../lib/createState'
import { parseWorkbook } from '../lib/parseWorkbook'
import { loadState, saveState } from '../lib/storage'
import type { AppState, Bill, Budget, Category, Debt, Filters, Goal, Transaction, TxKind } from '../lib/types'
import { sheetsFromArrayBuffer } from '../lib/xlsxIo'

interface StoreValue {
  state: AppState
  ready: boolean
  update(patch: (state: AppState) => AppState): void
  setFilters(patch: Partial<Filters>): void
  applyWorkbook(buffer: ArrayBuffer, asOf: string): ReturnType<typeof parseWorkbook>
  commitImport(result: ReturnType<typeof parseWorkbook>): void
  saveTransaction(transaction: Transaction, isNew: boolean): void
  deleteTransaction(id: string): void
  saveCategory(category: Category): void
  mergeCategory(sourceId: string, targetId: string): void
  saveBudget(budget: Budget): void
  deleteBudget(id: string): void
  saveGoal(goal: Goal): void
  deleteGoal(id: string): void
  saveDebt(debt: Debt): void
  deleteDebt(id: string): void
  saveBill(bill: Bill): void
  replaceState(state: AppState): void
}

const StoreContext = createContext<StoreValue | null>(null)

function blank(): AppState {
  return {
    version: 1,
    transactions: [],
    categories: [],
    budgets: [],
    goals: [],
    debts: [],
    incomePlans: [],
    recurring: [],
    bills: [],
    assumptions: {
      rates: { incomeTax: 0, pension: 0, unemployment: 0, health: 0, longTermCare: 0 },
      ratesAreEstimates: true,
      targetSavingsRate: 0,
      sipRoundToEuros: 50,
      shareSegments: [],
      planStart: null,
      planEnd: null,
      manualRunRateIncomeCents: null,
      manualRunRateExpenseCents: null,
      accounts: [],
      horizonNotes: [],
    },
    coverage: [],
    issues: [],
    reconciliation: [],
    stats: null,
    suppressedIds: [],
    settings: { theme: 'light', sidebarCollapsed: false, assumptionsLocked: false },
    lastImportAt: null,
    filters: { month: 'all', categoryId: 'all', kind: 'all', origin: 'actual', chapter: 'student' },
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(blank)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const saved = await loadState()
        if (!active) return
        if (saved && isAppState(saved)) {
          setState(saved)
          return
        }
        const response = await fetch('/seed.json')
        if (response.ok) {
          const seed = await response.json()
          if (isAppState(seed)) {
            setState(seed)
            await saveState(seed)
          }
        }
      } finally {
        if (active) setReady(true)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    document.documentElement.dataset.theme = state.settings.theme
    void saveState(state)
  }, [state, ready])

  const value = useMemo<StoreValue>(() => ({
    state,
    ready,
    update: (patch) => setState((current) => patch(current)),
    setFilters: (patch) => setState((current) => ({ ...current, filters: { ...current.filters, ...patch } })),
    applyWorkbook: (buffer, asOf) => parseWorkbook(sheetsFromArrayBuffer(buffer), asOf),
    commitImport: (result) => setState((current) => createState(result, current)),
    saveTransaction: (transaction, isNew) => setState((current) => ({
      ...current,
      transactions: isNew
        ? [transaction, ...current.transactions]
        : current.transactions.map((item) => (item.id === transaction.id ? { ...transaction, edited: item.source === 'workbook' ? true : item.edited } : item)),
    })),
    deleteTransaction: (id) => setState((current) => {
      const target = current.transactions.find((item) => item.id === id)
      return {
        ...current,
        transactions: current.transactions.filter((item) => item.id !== id),
        suppressedIds: target?.source === 'workbook' ? [...current.suppressedIds, id] : current.suppressedIds,
      }
    }),
    saveCategory: (category) => setState((current) => ({
      ...current,
      categories: current.categories.some((item) => item.id === category.id)
        ? current.categories.map((item) => (item.id === category.id ? category : item))
        : [...current.categories, category].sort((a, b) => a.name.localeCompare(b.name)),
    })),
    mergeCategory: (sourceId, targetId) => setState((current) => ({
      ...current,
      transactions: current.transactions.map((item) => (item.categoryId === sourceId ? { ...item, categoryId: targetId, edited: true } : item)),
      budgets: current.budgets.map((item) => (item.categoryId === sourceId ? { ...item, categoryId: targetId } : item)),
      categories: current.categories.map((item) => (item.id === sourceId ? { ...item, active: false } : item)),
    })),
    saveBudget: (budget) => setState((current) => ({
      ...current,
      budgets: current.budgets.some((item) => item.id === budget.id)
        ? current.budgets.map((item) => (item.id === budget.id ? budget : item))
        : [...current.budgets, budget],
    })),
    deleteBudget: (id) => setState((current) => ({ ...current, budgets: current.budgets.filter((item) => item.id !== id) })),
    saveGoal: (goal) => setState((current) => ({
      ...current,
      goals: current.goals.some((item) => item.id === goal.id)
        ? current.goals.map((item) => (item.id === goal.id ? goal : item))
        : [...current.goals, goal],
    })),
    deleteGoal: (id) => setState((current) => ({ ...current, goals: current.goals.filter((item) => item.id !== id) })),
    saveDebt: (debt) => setState((current) => ({
      ...current,
      debts: current.debts.some((item) => item.id === debt.id)
        ? current.debts.map((item) => (item.id === debt.id ? debt : item))
        : [...current.debts, debt],
    })),
    deleteDebt: (id) => setState((current) => ({ ...current, debts: current.debts.filter((item) => item.id !== id) })),
    saveBill: (bill) => setState((current) => ({
      ...current,
      bills: current.bills.some((item) => item.id === bill.id)
        ? current.bills.map((item) => (item.id === bill.id ? bill : item))
        : [...current.bills, bill],
    })),
    replaceState: (next) => setState(next),
  }), [state, ready])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext)
  if (!value) throw new Error('Store missing')
  return value
}

export function newTransaction(partial: Partial<Transaction> & Pick<Transaction, 'date' | 'amountCents' | 'categoryId' | 'kind'>): Transaction {
  return {
    id: uid('manual'),
    dayKnown: true,
    description: '',
    account: '',
    notes: '',
    origin: 'actual',
    confidence: 'confirmed',
    source: 'manual',
    recurring: false,
    ...partial,
  }
}

export type { TxKind }
