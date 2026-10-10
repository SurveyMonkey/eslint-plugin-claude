// Red first: the rule does not exist yet, so the case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

describe('mcp-server-name-reserved (red)', () => {
  it.fails('reports a reserved name', () => {
    const code = '{"mcpServers": {"workspace": {"command": "x"}}}'
    expect(lintJson('mcp-server-name-reserved', code, '.mcp.json').map((m) => m.messageId)).toEqual(
      ['reserved'],
    )
  })
})
