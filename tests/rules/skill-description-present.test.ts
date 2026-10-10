// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const ids = (code: string, file = '.claude/skills/s/SKILL.md') =>
  lintMarkdown('skill-description-present', code, file).map((m) => m.messageId)

describe('skill-description-present (red)', () => {
  it.fails('reports a skill with no description', () => {
    expect(ids('---\nname: s\n---\n')).toEqual(['missing'])
  })
  it.fails('reports a blank description', () => {
    expect(ids('---\ndescription: "  "\n---\n')).toEqual(['missing'])
  })
  it.fails('stays silent with a description', () => {
    expect(ids('---\ndescription: d\n---\n')).toEqual([])
  })
})
