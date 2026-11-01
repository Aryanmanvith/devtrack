import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

/*
 * End-to-end tests start their own isolated stack:
 *   - the FastAPI backend on port 8001 with a brand-new SQLite file in the OS temp folder
 *     (demo seeding disabled), so the developer database is never touched;
 *   - the Vite dev server on port 5174, proxying /api to that backend.
 * Run with `npm run test:e2e` after `npx playwright install chromium`, or point
 * PW_CHROMIUM_PATH at an installed Chrome/Chromium, or set PW_CHANNEL=chrome.
 */
const frontendDir = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(frontendDir, '..', 'backend')
const isWindows = process.platform === 'win32'
const python =
  process.env.DEVTRACK_E2E_PYTHON ??
  path.join(backendDir, '.venv', isWindows ? 'Scripts' : 'bin', isWindows ? 'python.exe' : 'python')

const dataDir = mkdtempSync(path.join(tmpdir(), 'devtrack-e2e-'))
const databaseUrl = `sqlite:///${path.join(dataDir, 'e2e.db').split(path.sep).join('/')}`

const API_PORT = 8001
const WEB_PORT = 5174

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    timezoneId: 'UTC',
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    channel: process.env.PW_CHANNEL || undefined,
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : undefined,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      command: `"${python}" -m uvicorn app.main:app --host 127.0.0.1 --port ${API_PORT}`,
      cwd: backendDir,
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        DEVTRACK_DATABASE_URL: databaseUrl,
        DEVTRACK_SEED_DEMO_DATA: 'false',
        DEVTRACK_CORS_ORIGINS: `http://127.0.0.1:${WEB_PORT}`,
      },
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      cwd: frontendDir,
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_API_PROXY_TARGET: `http://127.0.0.1:${API_PORT}`, VITE_API_BASE_URL: '' },
    },
  ],
})
