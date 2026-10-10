// Red first: the rule does not exist yet, so the case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

describe('mcp-oauth-values (red)', () => {
  it.fails('reports an array of scopes', () => {
    const code =
      '{"mcpServers": {"a": {"type": "http", "url": "https://x.test", "oauth": {"scopes": ["a"]}}}}'
    expect(lintJson('mcp-oauth-values', code, '.mcp.json').map((m) => m.messageId)).toEqual([
      'scopesArray',
    ])
  })
})
