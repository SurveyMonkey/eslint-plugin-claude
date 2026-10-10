// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const file = '.claude/skills/s/SKILL.md'
const ids = (code: string) =>
  lintMarkdown('skill-argument-escape', code, file).map((m) => m.messageId)

describe('skill-argument-escape (red)', () => {
  it.fails('reports a doubled backslash before an argument placeholder', () => {
    expect(ids('---\ndescription: d\n---\n\nPrice \\\\$1.00\n')).toEqual(['doubled'])
  })
  it.fails('stays silent for one backslash', () => {
    expect(ids('---\ndescription: d\n---\n\nPrice \\$1.00\n')).toEqual([])
  })
})
