// Red first: the rule does not exist yet, so the case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

describe('mcp-env-expansion-field (red)', () => {
  it.fails('reports a reference in a field that does not expand', () => {
    const code = `{"mcpServers": {"a": {"type": "http", "url": "https://x.test", "timeout": "\${T}"}}}`
    expect(lintJson('mcp-env-expansion-field', code, '.mcp.json').map((m) => m.messageId)).toEqual([
      'literal',
    ])
  })
})
