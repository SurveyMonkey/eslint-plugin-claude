// Red first: the rule does not exist yet, so the case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

describe('mcp-project-plugin-bundle (red)', () => {
  it.fails('reports an MCP bundle in a project skills-directory plugin', () => {
    const code = '{"name": "p", "mcpServers": "./server.mcpb"}'
    expect(
      lintJson(
        'mcp-project-plugin-bundle',
        code,
        '.claude/skills/p/.claude-plugin/plugin.json',
      ).map((m) => m.messageId),
    ).toEqual(['skipped'])
  })
})
