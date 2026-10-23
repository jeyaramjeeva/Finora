import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'
import { handleAuthRequest, passwordsMatch, usernameAllowed } from '../../server/auth.mjs'

describe('sign-in name', () => {
  it('accepts only Jeeva Jeyaram', () => {
    expect(usernameAllowed('Jeeva Jeyaram')).toBe(true)
    expect(usernameAllowed(' Jeeva Jeyaram ')).toBe(true)
    expect(usernameAllowed('jeeva jeyaram')).toBe(false)
    expect(usernameAllowed('Someone Else')).toBe(false)
  })

  it('compares the full password', () => {
    expect(passwordsMatch('correct-horse', 'correct-horse')).toBe(true)
    expect(passwordsMatch('correct-horse', 'correct-horses')).toBe(false)
    expect(passwordsMatch('short', 'correct-horse')).toBe(false)
  })

  it('signs in only the matching name and password', async () => {
    process.env.CASHMETRY_PASSWORD = 'test-secret'
    process.env.CASHMETRY_SESSION_SECRET = 'a'.repeat(32)
    const ok = await postLogin({ username: 'Jeeva Jeyaram', password: 'test-secret' })
    const denied = await postLogin({ username: 'Someone Else', password: 'test-secret' })
    expect(ok.status).toBe(200)
    expect(denied.status).toBe(401)
  })
})

function postLogin(body: { username: string; password: string }) {
  const req = new EventEmitter() as EventEmitter & { method: string; url: string; headers: Record<string, string> }
  req.method = 'POST'
  req.url = '/api/login'
  req.headers = {}
  let status = 0
  const res = {
    setHeader() {},
    end() {},
    get statusCode() { return status },
    set statusCode(value: number) { status = value },
  }
  const pending = handleAuthRequest(req, res)
  req.emit('data', Buffer.from(JSON.stringify(body)))
  req.emit('end')
  return pending.then(() => ({ status }))
}
