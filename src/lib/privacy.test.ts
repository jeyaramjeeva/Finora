import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import {
  isStealthMode,
  toggleStealthMode,
  getSavedPin,
  setSavedPin,
  verifyPin,
  shouldLock,
} from './privacy'

describe('privacy module', () => {
  const store = new Map<string, string>()
  const classList = new Set<string>()

  beforeAll(() => {
    // Provide node test environment mocks
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, String(v)),
      removeItem: (k: string) => { store.delete(k) },
      clear: () => store.clear(),
      length: 0,
      key: () => null,
    } as unknown as Storage

    globalThis.document = {
      documentElement: {
        classList: {
          add: (c: string) => classList.add(c),
          remove: (c: string) => classList.delete(c),
          contains: (c: string) => classList.has(c),
        },
      },
    } as unknown as Document

    globalThis.window = {
      dispatchEvent: () => true,
    } as unknown as Window & typeof globalThis
  })

  beforeEach(() => {
    store.clear()
    classList.clear()
  })

  it('toggles stealth mode and persists to localStorage', () => {
    expect(isStealthMode()).toBe(false)
    const active = toggleStealthMode()
    expect(active).toBe(true)
    expect(isStealthMode()).toBe(true)
    expect(document.documentElement.classList.contains('is-stealth')).toBe(true)

    const deactivated = toggleStealthMode()
    expect(deactivated).toBe(false)
    expect(isStealthMode()).toBe(false)
    expect(document.documentElement.classList.contains('is-stealth')).toBe(false)
  })

  it('manages 4-digit PIN security lock', () => {
    expect(getSavedPin()).toBeNull()
    setSavedPin('1234')
    expect(getSavedPin()).toBe('1234')

    expect(verifyPin('0000')).toBe(false)
    expect(verifyPin('1234')).toBe(true)
  })

  it('does not lock if no PIN is set', () => {
    expect(shouldLock()).toBe(false)
  })
})
