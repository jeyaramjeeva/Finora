import { describe, it, expect } from 'vitest'
import { generateBlankExpenseTemplate } from './excelTemplate'
import * as XLSX from 'xlsx'

describe('excelTemplate generator', () => {
  it('generates a valid binary XLSX blob with expected sheets', async () => {
    const blob = generateBlankExpenseTemplate()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(1000)

    const arrayBuffer = await blob.arrayBuffer()
    const wb = XLSX.read(arrayBuffer, { type: 'array' })
    expect(wb.SheetNames).toContain('Student Monthly')
    expect(wb.SheetNames).toContain('Student Yearly')
    expect(wb.SheetNames).toContain('Full Time Monthly')
  })
})
