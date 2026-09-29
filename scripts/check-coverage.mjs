// Vitest's 100% thresholds pass when the report names no file at all: an
// empty `coverage.include` match reports "Unknown% (0/0)" and exits 0. This
// fails that case. Run after `vitest run --coverage`.
import { readFileSync } from 'node:fs'

const summary = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8'))
const files = Object.keys(summary).filter((key) => key !== 'total')

if (files.length === 0) {
  console.error('coverage: the report names no file. Check coverage.include in vitest.config.ts.')
  process.exit(1)
}
