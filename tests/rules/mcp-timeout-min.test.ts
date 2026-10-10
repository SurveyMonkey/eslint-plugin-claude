// Red first: the rule does not exist yet, so the case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

describe('mcp-timeout-min (red)', () => {
  it.fails('reports a timeout of 60', () => {
    const code = '{"mcpServers": {"a": {"command": "x", "timeout": 60}}}'
    expect(lintJson('mcp-timeout-min', code, '.mcp.json').map((m) => m.messageId)).toEqual([
      'tooSmall',
    ])
  })
})
