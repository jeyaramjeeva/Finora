import * as XLSX from 'xlsx'

export function generateBlankExpenseTemplate(): Blob {
  const wb = XLSX.utils.book_new()

  // 1. Student Monthly
  const studentMonthlyData = [
    ['Month', 'Category', 'Description', 'Amount EUR', 'Day', 'Notes'],
    ['2026-03', 'Rent', 'Warmmiete Apartment', 420.00, 1, 'Monthly rent transfer'],
    ['2026-03', 'Groceries', 'Rewe Supermarket', 45.20, 3, 'Weekly groceries'],
    ['2026-03', 'Transport', 'Deutschlandticket', 49.00, 1, 'Monthly regional ticket'],
  ]
  const wsStudentMonthly = XLSX.utils.aoa_to_sheet(studentMonthlyData)
  XLSX.utils.book_append_sheet(wb, wsStudentMonthly, 'Student Monthly')

  // 2. Student Yearly
  const studentYearlyData = [
    ['Category', '2026-01', '2026-02', '2026-03', '2026-04', 'Total'],
    ['Rent', 420, 420, 420, 420, '=SUM(B2:E2)'],
    ['Groceries', 280, 310, 290, 300, '=SUM(B3:E3)'],
    ['Transport', 49, 49, 49, 49, '=SUM(B4:E4)'],
  ]
  const wsStudentYearly = XLSX.utils.aoa_to_sheet(studentYearlyData)
  XLSX.utils.book_append_sheet(wb, wsStudentYearly, 'Student Yearly')

  // 3. Full Time Monthly
  const fullMonthlyData = [
    ['Category', 'Planned Monthly EUR', 'Kind', 'Notes'],
    ['Rent', 850.00, 'expense', 'Forecast apartment rental'],
    ['Groceries', 350.00, 'expense', 'Healthy cooking & food'],
    ['Deutschlandticket', 49.00, 'expense', 'Transit pass'],
    ['SIP (World ETF)', 500.00, 'savings_contribution', 'Long-term equity investment'],
  ]
  const wsFullMonthly = XLSX.utils.aoa_to_sheet(fullMonthlyData)
  XLSX.utils.book_append_sheet(wb, wsFullMonthly, 'Full Time Monthly')

  // 4. Repay
  const repayData = [
    ['Debt Name', 'Original Amount', 'Balance EUR', 'Monthly Pay', 'Notes'],
    ['Education Loan', 11500.00, 11500.00, 250.00, 'Family repayment'],
  ]
  const wsRepay = XLSX.utils.aoa_to_sheet(repayData)
  XLSX.utils.book_append_sheet(wb, wsRepay, 'Repay')

  const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
