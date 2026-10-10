// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const ids = (code: string, file = '.claude/skills/s/SKILL.md') =>
  lintMarkdown('skill-invocation-redundant-fields', code, file).map((m) => m.messageId)

describe('skill-invocation-redundant-fields (red)', () => {
  it.fails('reports when_to_use with disable-model-invocation', () => {
    expect(ids('---\ndisable-model-invocation: true\nwhen_to_use: x\n---\n')).toEqual(['whenToUse'])
  })
  it.fails('reports argument-hint with user-invocable false', () => {
    expect(ids('---\nuser-invocable: false\nargument-hint: x\n---\n')).toEqual(['argumentHint'])
  })
  it.fails('stays silent without the pair', () => {
    expect(ids('---\nwhen_to_use: x\nargument-hint: x\n---\n')).toEqual([])
  })
})
