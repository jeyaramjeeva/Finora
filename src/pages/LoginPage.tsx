import { useState, type FormEvent } from 'react'

export function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username, password }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.ok) {
        setError(typeof body.error === 'string' ? body.error : 'That name or password is not accepted.')
        return
      }
      onSuccess()
    } catch {
      setError('Sign-in could not be reached.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <img src="/cashmetry-logo.png" alt="" width={44} height={44} />
        <h1>Cashmetry</h1>
        <p>Sign in as Jeeva Jeyaram.</p>
        <label>
          <span>Name</span>
          <input
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </label>
        <label>
          <span>Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error ? <p className="login-error">{error}</p> : null}
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Checking…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
