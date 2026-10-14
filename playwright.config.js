import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://127.0.0.1:4182/spring-boot-reactor/'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4182 --strictPort',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 40_000,
    env: { DEPLOY_GITHUB_PAGES: 'true' },
  },
})
