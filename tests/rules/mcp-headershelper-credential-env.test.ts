// Red first: the rule does not exist yet, so the case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

describe('mcp-headershelper-credential-env (red)', () => {
  it.fails('reports a credential variable in a headersHelper', () => {
    const code =
      '{"mcpServers": {"a": {"type": "http", "url": "https://x.test", "headersHelper": "echo $MY_TOKEN"}}}'
    expect(
      lintJson('mcp-headershelper-credential-env', code, '.mcp.json').map((m) => m.messageId),
    ).toEqual(['removed'])
  })
})
