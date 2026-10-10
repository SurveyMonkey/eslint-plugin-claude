// The comparison behind the option `minVersion`.
import { expect, it } from 'vitest'
import { supportsBefore } from '../src/min-version.ts'
import { lintMarkdown } from './rule-tester.test-support.ts'

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

// A value that is not three numbers would compare as NaN or undefined, and turn the rule off
// with no sign. The schema must refuse it.
it.each(['2.1', 'v2.1.239', '2.1.239-beta', '2.1.x', ''])(
  'refuses the minVersion %j in the rules that take it',
  (minVersion) => {
    for (const name of ['skill-no-bom', 'skill-boolean-literal']) {
      expect(() =>
        lintMarkdown(name, '# S\n', '.claude/skills/s/SKILL.md', [{ minVersion }]),
      ).toThrow()
    }
  },
)
