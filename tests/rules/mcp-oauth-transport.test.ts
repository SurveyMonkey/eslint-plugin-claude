// Red first: the rule does not exist yet, so the case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

describe('mcp-oauth-transport (red)', () => {
  it.fails('reports oauth on a stdio server', () => {
    const code = '{"mcpServers": {"a": {"command": "x", "oauth": {"clientId": "i"}}}}'
    expect(lintJson('mcp-oauth-transport', code, '.mcp.json').map((m) => m.messageId)).toEqual([
      'ignored',
    ])
  })
})
