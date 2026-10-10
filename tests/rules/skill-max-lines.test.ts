// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const file = '.claude/skills/s/SKILL.md'
const lines = (count: number) => `${'line\n'.repeat(count)}`
const ids = (code: string, options: unknown[] = []) =>
  lintMarkdown('skill-max-lines', code, file, options).map((m) => m.messageId)

describe('skill-max-lines (red)', () => {
  it.fails('reports a file of 500 lines', () => {
    expect(ids(lines(500))).toEqual(['overDocsLimit'])
  })
  it.fails('stays silent for a file of 499 lines', () => {
    expect(ids(lines(499))).toEqual([])
  })
  it.fails('names the configured limit at another value', () => {
    expect(ids(lines(10), [{ max: 10 }])).toEqual(['overConfiguredLimit'])
  })
})
