# Personal finance dashboard

A local dashboard for the `Expense Tracker.xlsx` workbook. It reads the file in the browser, stores the records in this browser, and recalculates income, spending, savings, budgets, debt, and a 6- or 12-month forecast.

The original Excel file is never modified. Uploading a newer copy replaces the workbook rows and leaves records you added by hand.

## Setup

```bash
npm install
npm test
npm run seed
npm run dev
```

Open the address Vite prints, usually `http://localhost:5173`.

`npm run seed` reads `C:\Users\Jjeyara\Downloads\Expense Tracker.xlsx` and writes `public/seed.json` so the first visit is already filled. If that file is somewhere else, change the path in `scripts/makeSeed.ts` or skip the seed and use **Update from Excel** on the Data page.

## Update the workbook

1. Save your Excel file as usual.
2. Open **Data** or **Update from Excel**.
3. Choose the `.xlsx` file and review the import summary.
4. Click **Apply import**.

What the import does:

- Student Yearly and Student Monthly become actual records from December 2023 through February 2026.
- From July 2025, daily food lines replace the yearly Food total so those expenses are not counted twice.
- Withdrawals are transfers, not expenses.
- Explicit zeros are skipped. Empty cells are not treated as zero.
- The full-time sheets are a plan from January 2027, not history. Non-zero amounts become recurring plan rules.
- Salary deductions stay labelled as estimates because they are percentage formulas, not payslips.
- The Info sheet is ignored. Tax ID, social security number, and bank account details are not stored.
- Months that do not match the workbook Spend row are listed, including semester fees left out of that formula and the February 2026 DB tickets that have no total formula.

## Privacy

Records stay in IndexedDB on this computer. Nothing is sent to a bank or another server. Backups are plain JSON and are not encrypted. Do not publish this project if `public/seed.json` contains your records.

## Calculations

- Monthly savings = actual income − actual expenses − debt payments.
- Savings rate = savings ÷ income, and is blank when income is zero or missing.
- Budget remaining = budget − recorded spending in that category.
- Net worth is shown only when every asset and liability balance has been entered. It is currently unknown.
- Debt remaining = original items + interest you record − payments. A negative workbook remainder is shown as a discrepancy and is not added to outstanding debt.

## Tests

```bash
npm test
```

The suite checks currency rounding, savings, budgets, debt payoff, duplicate detection, and the real workbook totals.
