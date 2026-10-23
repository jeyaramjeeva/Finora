/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { handleAuthRequest } from './server/auth.mjs'

function authApi(): Plugin {
  return {
    name: 'cashmetry-auth',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0]
        if (url !== '/api/login' && url !== '/api/session' && url !== '/api/logout') {
          next()
          return
        }
        void handleAuthRequest(req, res)
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  process.env.CASHMETRY_PASSWORD ??= env.CASHMETRY_PASSWORD
  process.env.CASHMETRY_SESSION_SECRET ??= env.CASHMETRY_SESSION_SECRET
  return {
    plugins: [react(), authApi()],
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }
})
