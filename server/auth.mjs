import { createHmac, timingSafeEqual } from 'node:crypto'

export const ALLOWED_USERNAME = 'Jeeva Jeyaram'
const COOKIE = 'cashmetry_session'
const MAX_AGE = 60 * 60 * 24 * 30

export function usernameAllowed(name) {
  return typeof name === 'string' && name.trim() === ALLOWED_USERNAME
}

export function passwordsMatch(input, expected) {
  if (typeof input !== 'string' || typeof expected !== 'string' || !expected) return false
  const left = Buffer.from(input)
  const right = Buffer.from(expected)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function authConfigured() {
  return Boolean(process.env.CASHMETRY_PASSWORD && process.env.CASHMETRY_SESSION_SECRET)
}

export function credentialsAccepted(username, password) {
  return usernameAllowed(username) && passwordsMatch(password, process.env.CASHMETRY_PASSWORD ?? '')
}

function sign(body) {
  return createHmac('sha256', process.env.CASHMETRY_SESSION_SECRET).update(body).digest('base64url')
}

export function sessionCookie() {
  const exp = Date.now() + MAX_AGE * 1000
  const body = Buffer.from(JSON.stringify({ u: ALLOWED_USERNAME, exp })).toString('base64url')
  const token = `${body}.${sign(body)}`
  const secure = process.env.VERCEL ? '; Secure' : ''
  return `${COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${secure}`
}

export function clearSessionCookie() {
  const secure = process.env.VERCEL ? '; Secure' : ''
  return `${COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure}`
}

export function hasSession(cookieHeader) {
  if (!process.env.CASHMETRY_SESSION_SECRET) return false
  const raw = String(cookieHeader ?? '')
  const part = raw.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${COOKIE}=`))
  if (!part) return false
  const token = part.slice(COOKIE.length + 1)
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return false
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = sign(body)
  const left = Buffer.from(sig)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    return payload.u === ALLOWED_USERNAME && typeof payload.exp === 'number' && payload.exp > Date.now()
  } catch {
    return false
  }
}

function send(res, status, body, cookie) {
  if (cookie) res.setHeader('Set-Cookie', cookie)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function readJson(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body)
  if (typeof req.body === 'string' && req.body) {
    try {
      return Promise.resolve(JSON.parse(req.body))
    } catch {
      return Promise.resolve({})
    }
  }
  return new Promise((resolve) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })
}

export async function handleAuthRequest(req, res) {
  const url = String(req.url ?? '').split('?')[0]
  if (url !== '/api/login' && url !== '/api/session' && url !== '/api/logout') return false

  if (url === '/api/session' && req.method === 'GET') {
    send(res, 200, { ok: hasSession(req.headers.cookie) })
    return true
  }

  if (url === '/api/logout' && req.method === 'POST') {
    send(res, 200, { ok: true }, clearSessionCookie())
    return true
  }

  if (url === '/api/login' && req.method === 'POST') {
    if (!authConfigured()) {
      send(res, 503, { ok: false, error: 'Sign-in is not configured.' })
      return true
    }
    const body = await readJson(req)
    if (!credentialsAccepted(body.username, body.password)) {
      send(res, 401, { ok: false, error: 'That name or password is not accepted.' })
      return true
    }
    send(res, 200, { ok: true, name: ALLOWED_USERNAME }, sessionCookie())
    return true
  }

  send(res, 405, { ok: false, error: 'Method not allowed.' })
  return true
}
