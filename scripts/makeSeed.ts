import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { createState } from '../src/lib/createState'
import { parseWorkbook } from '../src/lib/parseWorkbook'
import { sheetsFromArrayBuffer } from '../src/lib/xlsxIo'

const source = 'C:\\Users\\Jjeyara\\Downloads\\Expense Tracker.xlsx'
const buffer = readFileSync(source)
const bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
const result = parseWorkbook(sheetsFromArrayBuffer(bytes), '2026-10-22')
const state = createState(result)
mkdirSync('public', { recursive: true })
writeFileSync('public/seed.json', JSON.stringify(state))
console.log(`Wrote public/seed.json with ${state.transactions.length} records`)
