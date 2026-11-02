import { defineConfig, devices } from '@playwright/test'

// Runs against production builds of both playgrounds: `pnpm build:playgrounds` first.
const apps = [
  { name: 'nuxt', baseURL: 'http://127.0.0.1:4310', command: 'node playground/.output/server/index.mjs' },
  { name: 'vue', baseURL: 'http://127.0.0.1:4311', command: 'vite preview playground-vue --host 127.0.0.1 --port 4311 --strictPort' },
]
const browsers = [
  { name: 'chromium', use: devices['Desktop Chrome'] },
  { name: 'webkit', use: devices['Desktop Safari'] },
]

export default defineConfig({
  testDir: 'test/e2e',
  workers: 2,
  reporter: [['list']],
  projects: apps.flatMap(app => browsers.map(browser => ({
    name: `${app.name}-${browser.name}`,
    use: { ...browser.use, baseURL: app.baseURL, viewport: { width: 1000, height: 700 } },
  }))),
  webServer: apps.map(app => ({
    command: app.command,
    url: app.baseURL,
    env: { HOST: '127.0.0.1', PORT: '4310' },
    reuseExistingServer: false,
  })),
})
