// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const file = '.claude/skills/s/SKILL.md'
const ids = (code: string, options: unknown[] = []) =>
  lintMarkdown('skill-body-token-budget', code, file, options).map((m) => m.messageId)

describe('skill-body-token-budget (red)', () => {
  it.fails('reports a body of more than 5,000 estimated tokens', () => {
    expect(ids('a'.repeat(20001))).toEqual(['overCompactionCap'])
  })
  it.fails('stays silent for a body of 5,000 estimated tokens', () => {
    expect(ids('a'.repeat(20000))).toEqual([])
  })
  it.fails('names the configured limit at another value', () => {
    expect(ids('a'.repeat(41), [{ max: 10 }])).toEqual(['overConfiguredLimit'])
  })
})
