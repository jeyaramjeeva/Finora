import { handleAuthRequest } from '../server/auth.mjs'

export default function handler(req, res) {
  req.url = '/api/logout'
  return handleAuthRequest(req, res)
}
