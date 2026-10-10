// Red first: the rule does not exist yet, so the case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

describe('mcp-authorization-header-with-oauth (red)', () => {
  it.fails('reports oauth beside a static Authorization header', () => {
    const code =
      '{"mcpServers": {"a": {"type": "http", "url": "https://x.test", "headers": {"Authorization": "t"}, "oauth": {}}}}'
    expect(
      lintJson('mcp-authorization-header-with-oauth', code, '.mcp.json').map((m) => m.messageId),
    ).toEqual(['shadowed'])
  })
})
