import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright: the real browser seam. Vitest with jsdom cannot run canvas
 * drawing, image decode, the Batch Export Web Worker, or the ZIP download,
 * so these tests check the rendered result instead of the draw commands.
 *
 * Run with `npm run test:e2e`. Fixtures are generated in the page canvas, so
 * no binary test files are committed.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5199',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.CI
    ? {
        // The production build exercises the real Worker chunk; `vite preview`
        // serves it the way the shipped app will.
        command: 'npm run build && npm run preview -- --port 5199 --strictPort',
        url: 'http://localhost:5199',
        reuseExistingServer: false,
        timeout: 180_000,
      }
    : {
        command: 'npm run dev -- --port 5199 --strictPort',
        url: 'http://localhost:5199',
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
