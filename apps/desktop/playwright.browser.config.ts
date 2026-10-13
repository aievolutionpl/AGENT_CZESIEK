import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e/browser',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5194', headless: true },
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 5194 --strictPort',
    url: 'http://127.0.0.1:5194/e2e/browser/onboarding.html',
    timeout: 120_000
  }
})
