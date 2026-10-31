import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    env: { TRADING_MODE: 'paper' },
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/test/**/*.test.ts'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
