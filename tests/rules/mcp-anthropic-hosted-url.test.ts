// Red first: the rule does not exist yet, so the case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

describe('mcp-anthropic-hosted-url (red)', () => {
  it.fails('reports a server at an Anthropic-hosted connector URL', () => {
    const code =
      '{"mcpServers": {"a": {"type": "http", "url": "https://gmail.mcp.claude.com/mcp"}}}'
    expect(lintJson('mcp-anthropic-hosted-url', code, '.mcp.json').map((m) => m.messageId)).toEqual(
      ['hosted'],
    )
  })
})
