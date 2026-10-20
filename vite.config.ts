import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    // e2e/ holds Playwright browser tests; without this the Vitest default
    // include (`**/*.{test,spec}.?(c|m)[jt]s?(x)`) would collect them and fail.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
