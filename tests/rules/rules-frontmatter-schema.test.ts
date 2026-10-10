// A rule file reads one frontmatter field, `paths`
// (https://code.claude.com/docs/en/memory#rules-frontmatter-reference).
import { describe, expect, it } from 'vitest'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const lint = (code: string) =>
  lintMarkdown('rules-frontmatter-schema', code, '/repo/.claude/rules/a.md')

describe('rules-frontmatter-schema', () => {
  it.fails('reports a frontmatter key other than paths', () => {
    expect(lint('---\nglobs: "*.ts"\n---\n').map((m) => m.messageId)).toEqual(['unknownKey'])
  })

  it.fails('stays silent on a paths list', () => {
    expect(lint('---\npaths:\n  - "src/**/*.ts"\n---\n')).toEqual([])
  })
})
