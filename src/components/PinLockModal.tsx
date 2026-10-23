import { useState } from 'react'
import { Lock } from 'lucide-react'
import { getSavedPin, updateLastActive } from '../lib/privacy'

interface PinLockModalProps {
  open: boolean
  onUnlock: () => void
}

export function PinLockModal({ open, onUnlock }: PinLockModalProps) {
  const [pinInput, setPinInput] = useState('')
  const [error, setError] = useState(false)

  if (!open) return null

  const savedPin = getSavedPin()

  function handleAttempt(val: string) {
    setPinInput(val)
    if (val.length === 4) {
      if (!savedPin || val === savedPin) {
        setError(false)
        setPinInput('')
        updateLastActive()
        onUnlock()
      } else {
        setError(true)
        setTimeout(() => {
          setPinInput('')
          setError(false)
        }, 1000)
      }
    }
  }

  return (
    <div className="pin-lock-overlay">
      <div className="pin-lock-box">
        <div className="pin-lock-icon">
          <Lock size={28} />
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '10px 0 4px' }}>Cashmetry Locked</h2>
        <p className="muted" style={{ fontSize: '0.84rem', margin: '0 0 16px' }}>
          Enter your 4-digit security PIN to access financial records
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 16 }}>
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`pin-dot ${pinInput.length > idx ? 'is-filled' : ''} ${error ? 'is-error' : ''}`}
            />
          ))}
        </div>

        {error && <div style={{ color: 'var(--danger)', fontSize: '0.78rem', marginBottom: 12 }}>Incorrect PIN</div>}

        {/* Numpad */}
        <div className="pin-numpad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '⌫'].map((k) => (
            <button
              key={String(k)}
              type="button"
              className="pin-key"
              onClick={() => {
                if (k === 'C') setPinInput('')
                else if (k === '⌫') setPinInput((p) => p.slice(0, -1))
                else if (typeof k === 'number' && pinInput.length < 4) handleAttempt(pinInput + k)
              }}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
