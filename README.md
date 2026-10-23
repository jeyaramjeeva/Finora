# Cashmetry

A complete, production-grade personal financial management dashboard built directly from `Expense Tracker.xlsx`. It provides real-time analytics, automated data reconciliation, debt payoff modeling, monthly and annual budgeting, and a 6- to 12-month financial forecasting engine.

---

## Key Capabilities

1. **Workbook Preservation & Zero Cloud Exposure**
   - The original Excel file (`Expense Tracker.xlsx`) is never modified.
   - All calculations run 100% locally in the browser; records persist securely in your browser's IndexedDB.
   - **Sensitive Data Protection**: Personal identifiers on the `Info` sheet (Tax ID, Social Security Number, IBAN, BIC) are automatically detected and omitted from all storage and logs.

2. **Live Excel Synchronization**
   - Every time you update `Expense Tracker.xlsx`, simply drop it onto any screen or click **Update from Excel**.
   - An instant audit preview displays:
     - Record counts by transaction type (income, expense, transfer, debt payment).
     - Coverage span (Dec 2023 to Feb 2026 actuals; 2027+ full-time recurring rules).
     - Reconciliation analysis against the spreadsheet's formulas (flagging semester fees, unsummed tickets, etc.).
   - Clicking **Apply Import** synchronizes all dashboard metrics, updates the active period, and preserves your manual adjustments.

3. **Executive Financial Brief (Answers to the 8 Core Questions)**
   Directly communicates answers for the selected month:
   - **How much did I earn this month?** Net income with prior month delta and source breakdown.
   - **How much did I spend?** Total living expenses, excluding account transfers.
   - **How much money did I save?** Net savings and savings rate percentage.
   - **How much money is available after obligations?** Net unallocated cash buffer remaining in your account.
   - **Where does most of my money go?** Top 3 spending categories with percentage shares.
   - **Am I spending more than planned?** Utilisation against set category budgets or trailing 3-month run-rate.
   - **How much debt do I still have?** Remaining principal balance (Appa loan balance; Anna student debt fully settled).
   - **How much money can I realistically save over the next 6 to 12 months?** Trajectory projections based on verified run-rates.

4. **10 Dedicated Analytical Sections**
   - **Dashboard**: KPI summary cards, interactive income vs. expense bar charts, category breakdown with vertical bar and donut toggles, spend stack, and category drill-down tables.
   - **Income Analysis**: Gross vs. Net comparison, statutory payroll deductions breakdown (tax, pension, health, care, unemployment), annual income trends, career progression milestones (Primark → HZDR → Trimble → Full-time), and interactive payslip simulator.
   - **Expense Tracking**: Search, sort, date range filters (from/to), category filters, kind filters, account filters, clean pagination, quick CSV/Excel exports, and inline duplicate detection.
   - **Budgets & Spending Analysis**: Monthly and annual budget setting, progress bars with 75%, 90%, and 100% alerts, projected month-end burn rate, and fixed vs. variable cost split.
   - **Savings & Goals Planner**: Compounding models for workbook investment horizons (SIP Germany ETF, Indian SIP, Gold, Emergency Fund, Trimble Shares), target countdowns, and contribution requirements.
   - **Debt & Repayment Management**: Full debt ledger for Anna and Appa loans, principal vs. interest payment logging, and Avalanche vs. Snowball payoff scenario projections.
   - **Financial Calendar**: Day-by-day calendar grid of confirmed expenses and scheduled bills, recurring due date manager, and projected monthly cash flow buffer.
   - **Financial Forecasting**: 6-month and 12-month projections across Conservative, Expected, and Optimistic scenarios with customizable run-rate assumptions.
   - **Interactive Reports**: Category pie drill-downs, actual vs. budget benchmarks, year-over-year deltas, debt reduction curve, and net worth balance sheet.
   - **Data Management**: Excel import/review, CSV import with duplicate resolution, CSV export, Excel export, and full JSON backup/restore.

---

## Setup & Running Locally

### Prerequisites
- Node.js (v18 or newer recommended)

### Quick Start
```bash
# 1. Install dependencies
npm install

# 2. Run automated test suite
npm test

# 3. Seed initial state from your local Expense Tracker.xlsx
npm run seed

# 4. Start local development server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Updating from Excel

1. Edit and save `Expense Tracker.xlsx` on your computer as usual.
2. In the dashboard, click **Update from Excel** in the top navigation bar or drag and drop your `.xlsx` file anywhere onto the browser window.
3. Review the import audit summary:
   - Number of records parsed.
   - Historical vs. plan separation.
   - Reconciliation differences.
4. Click **Apply Import & Update Dashboard**.

---

## Financial Calculation Rules

- **Monthly Savings**: `actual income − actual living expenses − debt repayments`.
- **Savings Rate**: `monthly savings ÷ monthly income × 100` (blank when income is 0).
- **Budget Remaining**: `budget amount − eligible spending in period`.
- **Budget Utilisation**: `eligible spending ÷ budget amount × 100`.
- **Net Cash Left / Buffer**: `income − expenses − debt payments − savings transfers`.
- **Net Worth**: `total confirmed assets − total confirmed liabilities` (displayed as incomplete when account statements are unconfirmed).
- **Debt Balance**: `original components + interest recorded − payments`. Anna debt overpayment (-€2.00) is recognized as a surplus and not added to liabilities.

---

## Running Tests

```bash
cmd /c npm test
```
The Vitest suite validates currency rounding, savings mathematics, budget limits, 75%/90%/100% alerts, date filters, duplicate detection, debt payoff strategies, and reconciliation against the real Excel workbook.
