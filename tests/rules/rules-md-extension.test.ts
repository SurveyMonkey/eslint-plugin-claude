// Claude Code discovers only `.md` files in `.claude/rules/`
// (https://code.claude.com/docs/en/memory#set-up-rules).
import { describe, expect, it } from 'vitest'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const lint = (filename: string) => lintMarkdown('rules-md-extension', '# Rule\n', filename)

describe('rules-md-extension', () => {
  it.fails('reports a rule file with the extension .txt at line 1', () => {
    expect(
      lint('/repo/.claude/rules/style.txt').map((m) => [m.messageId, m.line, m.column]),
    ).toEqual([['extension', 1, 1]])
  })

  it.fails('stays silent on a rule file with the extension .md', () => {
    expect(lint('/repo/.claude/rules/style.md')).toEqual([])
  })
})
