// Claude Code matches each `claudeMdExcludes` pattern against absolute file paths
// (https://code.claude.com/docs/en/memory#exclude-specific-claude-md-files).
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const lint = (patterns: string[], filename = '.claude/settings.json') =>
  lintJson('claude-md-excludes-pattern', JSON.stringify({ claudeMdExcludes: patterns }), filename)

describe('claude-md-excludes-pattern', () => {
  it.fails('reports a relative-style pattern at the entry', () => {
    expect(lint(['packages/web/**']).map((m) => [m.messageId, m.line])).toEqual([['relative', 1]])
  })

  it.fails('stays silent on a pattern that starts with **/', () => {
    expect(lint(['**/packages/web/**'])).toEqual([])
  })
})
