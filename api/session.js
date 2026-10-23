import { handleAuthRequest } from '../server/auth.mjs'

export default function handler(req, res) {
  req.url = '/api/session'
  return handleAuthRequest(req, res)
}
