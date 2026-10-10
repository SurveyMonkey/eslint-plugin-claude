// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const file = '.claude/skills/s/SKILL.md'
const ids = (code: string) =>
  lintMarkdown('skill-model-override', code, file).map((m) => m.messageId)

describe('skill-model-override (red)', () => {
  it.fails('reports a model other than inherit', () => {
    expect(ids('---\nmodel: opus\n---\n\nBody\n')).toEqual(['override'])
  })
  it.fails('stays silent for inherit', () => {
    expect(ids('---\nmodel: inherit\n---\n\nBody\n')).toEqual([])
  })
  it.fails('stays silent for a forked skill', () => {
    expect(ids('---\nmodel: opus\ncontext: fork\n---\n\nBody\n')).toEqual([])
  })
})
