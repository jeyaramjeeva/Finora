// Privacy and Stealth Mode helpers
const STEALTH_KEY = 'cashmetry-stealth-mode'
const PIN_KEY = 'cashmetry-user-pin'
const LAST_ACTIVE_KEY = 'cashmetry-last-active'

export function isStealthMode(): boolean {
  return localStorage.getItem(STEALTH_KEY) === 'true'
}

export function setStealthMode(enabled: boolean): void {
  localStorage.setItem(STEALTH_KEY, enabled ? 'true' : 'false')
  if (enabled) {
    document.documentElement.classList.add('is-stealth')
  } else {
    document.documentElement.classList.remove('is-stealth')
  }
  window.dispatchEvent(new CustomEvent('cashmetry-stealth-change', { detail: enabled }))
}

export function toggleStealthMode(): boolean {
  const next = !isStealthMode()
  setStealthMode(next)
  return next
}

export function initStealthMode(): void {
  if (isStealthMode()) {
    document.documentElement.classList.add('is-stealth')
  }
}

// Optional PIN Lock
export function getSavedPin(): string | null {
  return localStorage.getItem(PIN_KEY)
}

export function setSavedPin(pin: string | null): void {
  if (pin) {
    localStorage.setItem(PIN_KEY, pin)
  } else {
    localStorage.removeItem(PIN_KEY)
  }
}

export function updateLastActive(): void {
  localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()))
}

export function verifyPin(input: string): boolean {
  const pin = getSavedPin()
  if (!pin) return true
  if (pin === input) {
    updateLastActive()
    return true
  }
  return false
}

export function shouldLock(timeoutMinutes = 15): boolean {
  const pin = getSavedPin()
  if (!pin) return false
  const last = Number(localStorage.getItem(LAST_ACTIVE_KEY) || '0')
  if (!last) return false
  return Date.now() - last > timeoutMinutes * 60 * 1000
}
