// Red first: the rule does not exist yet, so the case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

describe('mcp-settings-mcpservers (red)', () => {
  it.fails('reports mcpServers in a project settings file', () => {
    const code = '{"mcpServers": {"a": {"command": "x"}}}'
    expect(
      lintJson('mcp-settings-mcpservers', code, '.claude/settings.json').map((m) => m.messageId),
    ).toEqual(['unread'])
  })
})
