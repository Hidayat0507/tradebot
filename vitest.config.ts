import { defineConfig } from 'vitest/config'
import path from 'path'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'

export default defineConfig({
  // Offline tests must not load local credentials through Vite's dotenv support.
  envDir: mkdtempSync(path.join(tmpdir(), 'tradebot-test-env-')),
  test: {
    environment: 'node',
    maxWorkers: 2,
    minWorkers: 1,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/test/**/*.test.ts'],
    // Credential-driven integration tests must never contact an exchange in this offline suite.
    exclude: ['src/test/bitget-balance.test.ts'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
