import { defineConfig, devices } from "playwright/test"
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Browser plugin unavailable: use the repository's Playwright runner.
const workspace = process.env.NEXTEX_E2E_WORKSPACE || mkdtempSync(join(tmpdir(), 'nextex-e2e-'))
process.env.NEXTEX_E2E_WORKSPACE = workspace
writeFileSync(join(workspace, 'welcome.tex'), '\\documentclass{article}\n\\begin{document}\nWelcome to NexTex.\n\\end{document}\n')

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 10000 },
  outputDir: join(tmpdir(), 'nextex-playwright-results'),
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3011",
    trace: "retain-on-failure",
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: 'chromium', viewport: { width: 1440, height: 1000 } },
    },
  ],
  webServer: [
    { command: '../backend/venv/bin/python -m uvicorn main:app --app-dir ../backend --host 127.0.0.1 --port 8011',
      url: 'http://127.0.0.1:8011/health', reuseExistingServer: false, timeout: 30000,
      env: { NEXTEX_WORKSPACE_ROOT: workspace, NEXTEX_CONFIG_PATH: join(workspace, '.config.json'), NEXTEX_ALLOWED_ORIGINS: 'http://127.0.0.1:3011', NEXTEX_API_URL: 'http://127.0.0.1:8011' } },
    { command: 'npm run dev -- --hostname 127.0.0.1 --port 3011', url: 'http://127.0.0.1:3011',
      env: { NEXT_PUBLIC_API_URL: 'http://127.0.0.1:8011', NEXTEX_DIST_DIR: '.next-e2e', NEXT_TELEMETRY_DISABLED: '1', NEXTEX_AI_BASE_URL: 'http://127.0.0.1:8012/v1' },
      reuseExistingServer: false, timeout: 120000 },
    { command: 'node e2e/mock-ai.mjs', url: 'http://127.0.0.1:8012/health', reuseExistingServer: false, timeout: 10000 },
  ],
})
