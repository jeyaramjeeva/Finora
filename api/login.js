import { handleAuthRequest } from '../server/auth.mjs'

export default function handler(req, res) {
  req.url = '/api/login'
  return handleAuthRequest(req, res)
}
