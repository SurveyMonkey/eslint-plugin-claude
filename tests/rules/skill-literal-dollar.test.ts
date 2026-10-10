// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const file = '.claude/skills/s/SKILL.md'
const ids = (code: string) =>
  lintMarkdown('skill-literal-dollar', code, file).map((m) => m.messageId)

describe('skill-literal-dollar (red)', () => {
  it.fails('reports a price in prose', () => {
    expect(ids('The fee is $1.00 a month.\n')).toEqual(['literal'])
  })
  it.fails('stays silent for an escaped price', () => {
    expect(ids('The fee is \\$1.00 a month.\n')).toEqual([])
  })
})
