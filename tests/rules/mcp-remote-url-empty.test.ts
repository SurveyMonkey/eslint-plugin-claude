// Red first: the rule does not exist yet, so the case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

describe('mcp-remote-url-empty (red)', () => {
  it.fails('reports an empty url on a remote server', () => {
    const code = '{"mcpServers": {"a": {"type": "http", "url": ""}}}'
    expect(lintJson('mcp-remote-url-empty', code, '.mcp.json').map((m) => m.messageId)).toEqual([
      'empty',
    ])
  })
})
