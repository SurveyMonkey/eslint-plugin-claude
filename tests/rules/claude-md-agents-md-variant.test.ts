// Claude Code never reads `AGENTS.local.md`, `AGENTS.override.md` or a file below a `.agents/`
// directory (https://code.claude.com/docs/en/memory#when-claude-code-reads-agents-md).
import { describe, expect, it } from 'vitest'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const lint = (filename: string) =>
  lintMarkdown('claude-md-agents-md-variant', '# Notes\n', filename)

describe('claude-md-agents-md-variant', () => {
  it.fails('reports an AGENTS.local.md at line 1', () => {
    expect(lint('/repo/AGENTS.local.md').map((m) => [m.messageId, m.line, m.column])).toEqual([
      ['variant', 1, 1],
    ])
  })

  it.fails('stays silent on an AGENTS.md', () => {
    expect(lint('/repo/AGENTS.md')).toEqual([])
  })
})
