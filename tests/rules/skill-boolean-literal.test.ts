// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const ids = (code: string, file = '.claude/skills/s/SKILL.md') =>
  lintMarkdown('skill-boolean-literal', code, file).map((m) => m.messageId)

describe('skill-boolean-literal (red)', () => {
  it.fails('reports yes in a skill', () => {
    expect(ids('---\ndisable-model-invocation: yes\n---\n')).toEqual(['nonLiteral'])
  })
  it.fails('reports 0 in a command file', () => {
    expect(ids('---\nuser-invocable: 0\n---\n', '.claude/commands/c.md')).toEqual(['nonLiteral'])
  })
  it.fails('stays silent for true and false', () => {
    expect(ids('---\ndisable-model-invocation: true\nuser-invocable: false\n---\n')).toEqual([])
  })
})
