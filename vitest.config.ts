import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      include: ['src/**/*.ts'],
      reporter: ['text', 'json-summary'],
      thresholds: { 100: true },
    },
  },
})
