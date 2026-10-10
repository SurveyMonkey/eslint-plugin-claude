// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const file = '.claude/skills/deploy/SKILL.md'
const ids = (code: string, options: unknown[] = []) =>
  lintMarkdown('skill-precedence-shadowing', code, file, options).map((m) => m.messageId)

describe('skill-precedence-shadowing (red)', () => {
  it.fails('reports a project skill named in personalNames', () => {
    expect(ids('---\ndescription: d\n---\n', [{ personalNames: ['deploy'] }])).toEqual(['shadowed'])
  })
  it.fails('stays silent with no options', () => {
    expect(ids('---\ndescription: d\n---\n')).toEqual([])
  })
})
