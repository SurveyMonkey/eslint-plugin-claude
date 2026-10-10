// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const ids = (code: string, file = '.claude/skills/s/SKILL.md') =>
  lintMarkdown('skill-name-shadows-builtin', code, file).map((m) => m.messageId)

describe('skill-name-shadows-builtin (red)', () => {
  it.fails('reports a built-in command name', () => {
    expect(ids('---\nname: clear\n---\n')).toEqual(['builtIn'])
  })
  it.fails('reports a bundled skill name', () => {
    expect(ids('---\nname: batch\n---\n')).toEqual(['bundled'])
  })
  it.fails('stays silent for another name', () => {
    expect(ids('---\nname: deploy\n---\n')).toEqual([])
  })
})
