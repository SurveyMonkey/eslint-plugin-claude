// The comparison behind the option `minVersion`.
import { expect, it } from 'vitest'
import { supportsBefore } from '../src/min-version.ts'

it.each([
  ['2.1.238', true],
  ['2.1.239', false],
  ['2.1.240', false],
  ['2.0.999', true],
  ['2.2.0', false],
  ['1.99.99', true],
  ['3.0.0', false],
  ['2.1.9', true],
  ['2.1.100', true],
  ['2.1.1000', false],
])('compares %s with 2.1.239 by number, not by text', (minVersion, before) => {
  expect(supportsBefore(minVersion, '2.1.239')).toBe(before)
})

it('is false when minVersion is unset, so a rule is inactive', () => {
  expect(supportsBefore(undefined, '2.1.239')).toBe(false)
})
