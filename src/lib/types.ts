export type TxKind = 'income' | 'expense' | 'transfer' | 'debt_payment' | 'savings_contribution'

export type Origin = 'actual' | 'forecast'

export type Chapter = 'student' | 'employed'

export type Confidence = 'confirmed' | 'estimated' | 'needs_review'

export type TxSource = 'workbook' | 'manual' | 'csv'

export interface Transaction {
  id: string
  date: string
  dayKnown: boolean
  description: string
  categoryId: string
  amountCents: number
  kind: TxKind
  account: string
  notes: string
  origin: Origin
  confidence: Confidence
  source: TxSource
  sourceSheet?: string
  sourceCell?: string
  chapter?: Chapter
  recurring: boolean
  edited?: boolean
}

export interface Category {
  id: string
  name: string
  group: string
  kind: TxKind
  fixed: boolean
  active: boolean
  sourceName: string
  renamed?: boolean
}

export interface Budget {
  id: string
  categoryId: string
  period: 'month' | 'year'
  amountCents: number
}

export interface Goal {
  id: string
  name: string
  targetCents: number | null
  deadline: string | null
  currentBalanceCents: number | null
  monthlyContributionCents: number | null
  contributionEstimated: boolean
  source: TxSource | 'workbook'
  chapter?: Chapter
  notes: string
}

export interface DebtComponent {
  id: string
  name: string
  amountCents: number
  sourceCell?: string
}

export interface DebtPayment {
  id: string
  amountCents: number
  principalCents: number
  interestCents: number
  date: string | null
  sourceCell?: string
  note: string
}

export interface Debt {
  id: string
  name: string
  components: DebtComponent[]
  payments: DebtPayment[]
  interestRateAnnual: number | null
  minimumPaymentCents: number | null
  confirmedBalanceCents: number | null
  dueDay: number | null
  source: 'workbook' | 'manual'
  chapter?: Chapter
  notes: string
}

export interface IncomePlan {
  id: string
  name: string
  employer: string
  startMonth: string
  endMonth: string
  grossMonthlyCents: number
  source: 'workbook' | 'manual'
  chapter?: Chapter
  estimated: boolean
  notes: string
}

export interface RecurringRule {
  id: string
  name: string
  categoryId: string
  amountCents: number
  kind: TxKind
  startMonth: string
  endMonth: string | null
  origin: Origin
  confidence: Confidence
  source: 'workbook' | 'manual'
  sourceSheet?: string
  chapter?: Chapter
  note: string
}

export interface Bill {
  id: string
  name: string
  categoryId: string
  amountCents: number
  dueDay: number | null
  interval: 'monthly' | 'quarterly' | 'yearly'
  active: boolean
  source: 'detected' | 'user' | 'workbook'
  chapter?: Chapter
  lastSeenMonth: string | null
  note: string
}

export interface DeductionRates {
  incomeTax: number
  pension: number
  unemployment: number
  health: number
  longTermCare: number
}

export interface ShareSegment {
  startMonth: string
  endMonth: string
  rate: number
}

export interface AccountLabel {
  role: string
  name: string
}

export interface Assumptions {
  rates: DeductionRates
  ratesAreEstimates: boolean
  targetSavingsRate: number
  sipRoundToEuros: number
  shareSegments: ShareSegment[]
  planStart: string | null
  planEnd: string | null
  manualRunRateIncomeCents: number | null
  manualRunRateExpenseCents: number | null
  accounts: AccountLabel[]
  horizonNotes: string[]
}

export interface MonthCoverage {
  month: string
  incomeKnown: boolean
  expenseKnown: boolean
}

export interface ImportIssue {
  severity: 'info' | 'warning'
  code: string
  message: string
  sheet?: string
  cell?: string
}

export interface ReconciliationRow {
  month: string
  ledgerExpenseCents: number
  workbookSpendCents: number
  differenceCents: number
  notes: string[]
}

export interface ImportStats {
  transactionCount: number
  actualCount: number
  forecastRuleCount: number
  incomeCount: number
  expenseCount: number
  transferCount: number
  skippedZeros: number
  skippedCrossSheetTotals: number
  periodStart: string | null
  periodEnd: string | null
  actualStart: string | null
  actualEnd: string | null
  sheetsRead: string[]
}

export interface Filters {
  month: string
  categoryId: string
  kind: 'all' | TxKind
  origin: 'all' | Origin
  chapter?: Chapter
}

export interface Settings {
  theme: 'light' | 'dark'
  sidebarCollapsed: boolean
  assumptionsLocked: boolean
}

export interface AppState {
  version: 1
  transactions: Transaction[]
  categories: Category[]
  budgets: Budget[]
  goals: Goal[]
  debts: Debt[]
  incomePlans: IncomePlan[]
  recurring: RecurringRule[]
  bills: Bill[]
  assumptions: Assumptions
  coverage: MonthCoverage[]
  issues: ImportIssue[]
  reconciliation: ReconciliationRow[]
  stats: ImportStats | null
  suppressedIds: string[]
  settings: Settings
  lastImportAt: string | null
  workbookFileName?: string | null
  filters: Filters
}

export interface SheetData {
  name: string
  values: unknown[][]
  formulas: (string | null)[][]
}

export interface ImportResult {
  transactions: Transaction[]
  categories: Category[]
  debts: Debt[]
  incomePlans: IncomePlan[]
  recurring: RecurringRule[]
  goals: Goal[]
  bills: Bill[]
  assumptions: Assumptions
  coverage: MonthCoverage[]
  issues: ImportIssue[]
  reconciliation: ReconciliationRow[]
  stats: ImportStats
}
