// Red first: the rule does not exist yet, so the case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

describe('mcp-credential-var-remote (red)', () => {
  it.fails('reports a covered credential in headers', () => {
    const code = `{"mcpServers": {"a": {"type": "http", "url": "https://x.test", "headers": {"A": "\${NPM_TOKEN}"}}}}`
    expect(
      lintJson('mcp-credential-var-remote', code, '.mcp.json').map((m) => m.messageId),
    ).toEqual(['empty'])
  })
})
