/// <reference types="vitest/config" />
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const frontendDir = fileURLToPath(new URL('.', import.meta.url))
// One .env file at the repository root configures both the backend and the frontend.
const envDir = path.resolve(frontendDir, '..')

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '')
  // 127.0.0.1 rather than localhost: Node may resolve localhost to IPv6 (::1) on Windows,
  // while uvicorn listens on IPv4 by default.
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000'
  const proxy = { '/api': { target: apiTarget, changeOrigin: true } }

  return {
    envDir,
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(frontendDir, 'src') } },
    server: { port: 5173, strictPort: true, proxy },
    preview: { port: 4173, strictPort: true, proxy },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
      restoreMocks: true,
    },
  }
})
