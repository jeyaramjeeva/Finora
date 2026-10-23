import { openDB } from 'idb'
import type { AppState } from './types'

const DB_NAME = 'personal-finance-dashboard'
const STORE = 'kv'
const KEY = 'state'
const WORKBOOK_KEY = 'workbook'

export interface StoredWorkbook {
  fileName: string
  updatedAt: string
  bytes: ArrayBuffer
}

async function db() {
  return openDB(DB_NAME, 1, {
    upgrade(database) {
      database.createObjectStore(STORE)
    },
  })
}

export async function loadState(): Promise<AppState | null> {
  const database = await db()
  const value = await database.get(STORE, KEY)
  return value ?? null
}

export async function saveState(state: AppState): Promise<void> {
  const database = await db()
  await database.put(STORE, state, KEY)
}

export async function loadWorkbook(): Promise<StoredWorkbook | null> {
  const database = await db()
  const value = await database.get(STORE, WORKBOOK_KEY)
  return value ?? null
}

export async function saveWorkbook(workbook: StoredWorkbook): Promise<void> {
  const database = await db()
  await database.put(STORE, workbook, WORKBOOK_KEY)
}
