// Red first: the rule does not exist yet, so the case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

describe('mcp-hidden-whitespace (red)', () => {
  it.fails('reports a trailing newline in a header value', () => {
    const code =
      '{"mcpServers": {"a": {"type": "http", "url": "https://x.test", "headers": {"Authorization": "Bearer t\\n"}}}}'
    expect(lintJson('mcp-hidden-whitespace', code, '.mcp.json').map((m) => m.messageId)).toEqual([
      'value',
    ])
  })
})
