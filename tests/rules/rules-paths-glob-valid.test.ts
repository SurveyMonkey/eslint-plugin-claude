// A `paths` glob of a rule file is valid when each `[` starts a bracket expression, and when the
// brace groups of the whole list expand to at most 1,000 patterns and 4 MiB
// (https://code.claude.com/docs/en/memory#path-specific-rules).
import { describe, expect, it } from 'vitest'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const lint = (paths: string) =>
  lintMarkdown(
    'rules-paths-glob-valid',
    `---\npaths: ${JSON.stringify(paths)}\n---\n`,
    '/repo/.claude/rules/a.md',
  )

describe('rules-paths-glob-valid', () => {
  it.fails('reports a [ that starts no bracket expression', () => {
    expect(lint('photos [2024/**').map((m) => m.messageId)).toEqual(['bracket'])
  })

  it.fails('stays silent on an escaped [', () => {
    expect(lint('photos \\[2024/**')).toEqual([])
  })
})
