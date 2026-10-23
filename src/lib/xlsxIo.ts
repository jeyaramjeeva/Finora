import * as XLSX from 'xlsx'
import type { SheetData, Transaction } from './types'

const IDENTITY_TOKENS = ['iban', 'steuer', 'social security', 'tax id', 'bic']

/** Drop sheets that carry personal identifiers before the file is stored. */
export function stripIdentitySheets(data: ArrayBuffer): ArrayBuffer {
  const workbook = XLSX.read(data, { type: 'array' })
  for (const name of [...workbook.SheetNames]) {
    const sheet = workbook.Sheets[name]
    const text = XLSX.utils.sheet_to_csv(sheet).toLowerCase()
    const hits = IDENTITY_TOKENS.filter((token) => text.includes(token)).length
    if (hits < 2) continue
    delete workbook.Sheets[name]
    workbook.SheetNames = workbook.SheetNames.filter((sheetName) => sheetName !== name)
  }
  const written = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as Uint8Array
  return written.buffer.slice(written.byteOffset, written.byteOffset + written.byteLength) as ArrayBuffer
}

export function sheetsFromArrayBuffer(data: ArrayBuffer): SheetData[] {
  const workbook = XLSX.read(data, { type: 'array', cellDates: true, cellFormula: true })
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name]
    const ref = sheet['!ref']
    if (!ref) return { name, values: [], formulas: [] }
    const range = XLSX.utils.decode_range(ref)
    const height = range.e.r - range.s.r + 1
    const width = range.e.c - range.s.c + 1
    const values: unknown[][] = Array.from({ length: height }, () => Array(width).fill(null))
    const formulas: (string | null)[][] = Array.from({ length: height }, () => Array(width).fill(null))
    for (let row = range.s.r; row <= range.e.r; row += 1) {
      for (let col = range.s.c; col <= range.e.c; col += 1) {
        const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })] as { v?: unknown; f?: string } | undefined
        if (!cell) continue
        values[row - range.s.r][col - range.s.c] = cell.v ?? null
        formulas[row - range.s.r][col - range.s.c] = cell.f ? String(cell.f) : null
      }
    }
    return { name, values, formulas }
  })
}

export function transactionsToCsv(transactions: Transaction[], categoryName: (id: string) => string): string {
  const headers = ['date', 'description', 'category', 'amount', 'type', 'account', 'notes', 'origin', 'source']
  const lines = [headers.join(',')]
  for (const transaction of transactions) {
    const amount = (transaction.amountCents / 100).toFixed(2)
    lines.push([
      transaction.date,
      transaction.description,
      categoryName(transaction.categoryId),
      amount,
      transaction.kind,
      transaction.account,
      transaction.notes,
      transaction.origin,
      transaction.source,
    ].map(csvCell).join(','))
  }
  return lines.join('\n')
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export interface CsvRow {
  date: string
  description: string
  category: string
  amount: string
  type: string
  account: string
  notes: string
}

export function parseCsv(text: string): { rows: CsvRow[]; errors: string[] } {
  const errors: string[] = []
  const matrix = splitCsv(text).filter((row) => row.some((cell) => cell.trim()))
  if (matrix.length === 0) return { rows: [], errors: ['The file is empty.'] }
  const headers = matrix[0].map((cell) => cell.trim().toLowerCase())
  const index = (names: string[]) => headers.findIndex((header) => names.includes(header))
  const date = index(['date'])
  const description = index(['description', 'name', 'memo'])
  const category = index(['category'])
  const amount = index(['amount', 'value'])
  const type = index(['type', 'kind'])
  const account = index(['account', 'payment method'])
  const notes = index(['notes', 'note'])
  if (date < 0 || amount < 0 || category < 0) {
    errors.push('The CSV needs date, amount, and category columns.')
  }
  const rows: CsvRow[] = []
  if (errors.length) return { rows, errors }
  matrix.slice(1).forEach((row, position) => {
    rows.push({
      date: row[date]?.trim() ?? '',
      description: description >= 0 ? row[description]?.trim() ?? '' : '',
      category: row[category]?.trim() ?? '',
      amount: row[amount]?.trim() ?? '',
      type: type >= 0 ? row[type]?.trim() ?? '' : 'expense',
      account: account >= 0 ? row[account]?.trim() ?? '' : '',
      notes: notes >= 0 ? row[notes]?.trim() ?? '' : '',
    })
    if (!row[date] || !row[amount] || !row[category]) {
      errors.push(`Row ${position + 2} is missing a date, amount, or category.`)
    }
  })
  return { rows, errors }
}

function splitCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const source = text.replace(/^\uFEFF/, '')
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"'
          index += 1
        } else quoted = false
      } else cell += char
      continue
    }
    if (char === '"') quoted = true
    else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (char !== '\r') cell += char
  }
  row.push(cell)
  rows.push(row)
  return rows
}

export function workbookFromTransactions(transactions: Transaction[], categoryName: (id: string) => string): ArrayBuffer {
  const rows = transactions.map((transaction) => ({
    date: transaction.date,
    description: transaction.description,
    category: categoryName(transaction.categoryId),
    amount: transaction.amountCents / 100,
    type: transaction.kind,
    account: transaction.account,
    notes: transaction.notes,
    origin: transaction.origin,
    sourceSheet: transaction.sourceSheet ?? '',
    sourceCell: transaction.sourceCell ?? '',
  }))
  const sheet = XLSX.utils.json_to_sheet(rows)
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Transactions')
  return XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
}
