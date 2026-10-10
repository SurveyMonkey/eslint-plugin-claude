// The sub-agents page, "Trust required for inline MCP servers": Claude Code
// loads an inline server from `.claude/agents/` only after the folder is
// trusted.
import { describe, expect, it } from 'vitest'
import { agentText, lintRule } from '../agent-warn.test-support.ts'

const file = '/repo/.claude/agents/a.md'
const INLINE = 'mcpServers:\n  - playwright:\n      type: stdio\n      command: npx\n'

describe('agent-mcp-servers-inline-trust', () => {
  it.fails('reports an inline server', () => {
    const messages = lintRule('agent-mcp-servers-inline-trust', [], agentText(INLINE), file)
    expect(messages).toMatchObject([{ messageId: 'trust', line: 4 }])
  })

  it.fails('stays silent for a name reference', () => {
    expect(
      lintRule('agent-mcp-servers-inline-trust', [], agentText('mcpServers:\n  - github\n'), file),
    ).toEqual([])
  })
})
