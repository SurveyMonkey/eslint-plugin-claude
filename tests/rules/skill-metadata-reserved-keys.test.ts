// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const ids = (code: string, file = '.claude/skills/s/SKILL.md') =>
  lintMarkdown('skill-metadata-reserved-keys', code, file).map((m) => m.messageId)

describe('skill-metadata-reserved-keys (red)', () => {
  it.fails('reports a metadata key that is a frontmatter field', () => {
    expect(ids('---\nmetadata:\n  paths: src\n---\n')).toEqual(['reserved'])
  })
  it.fails('stays silent for other keys', () => {
    expect(ids('---\nmetadata:\n  team: web\n---\n')).toEqual([])
  })
})
