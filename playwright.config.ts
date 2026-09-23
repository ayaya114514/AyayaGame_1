import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : 3,
  timeout: 45_000,
  reporter: 'list',
  outputDir: 'test-results',
  use: { baseURL: 'http://127.0.0.1:4173/AyayaGame_1/', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } }
    },
    { name: 'iphone-webkit', use: { ...devices['iPhone 14'] } }
  ],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/AyayaGame_1/',
    reuseExistingServer: false,
    timeout: 30_000
  }
})
