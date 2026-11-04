import { defineConfig, devices } from '@playwright/test'

// Runs the same scenarios against vue-router/experimental alone, no code from this
// package: `pnpm build:experimental` first. Failures are the expected result here,
// so CI doesn't run it. EXPERIMENTAL.md has the latest results.
const apps = [
  { name: 'vue-experimental-plain', port: 4312 },
  { name: 'vue-experimental-workarounds', port: 4313 },
]
const browsers = [
  { name: 'chromium', use: devices['Desktop Chrome'] },
  { name: 'webkit', use: devices['Desktop Safari'] },
]

export default defineConfig({
  testDir: 'test/e2e',
  // These check this package's own dev warning and sessionStorage format, not behaviour
  grepInvert: /warns once in development|persisted by the previous runtime/,
  workers: 2,
  reporter: [['list']],
  projects: apps.flatMap(app => browsers.map(browser => ({
    name: `${app.name}-${browser.name}`,
    use: { ...browser.use, baseURL: `http://127.0.0.1:${app.port}`, viewport: { width: 1000, height: 700 } },
  }))),
  webServer: apps.map(app => ({
    command: `vite preview playground-experimental --outDir dist-${app.name.split('-').at(-1)} --host 127.0.0.1 --port ${app.port} --strictPort`,
    url: `http://127.0.0.1:${app.port}`,
    reuseExistingServer: false,
  })),
})
