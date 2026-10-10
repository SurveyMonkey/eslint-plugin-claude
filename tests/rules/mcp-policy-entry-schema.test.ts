// Red first: the rule does not exist yet, so the case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

describe('mcp-policy-entry-schema (red)', () => {
  it.fails('reports an entry with two keys', () => {
    const code = '{"allowedMcpServers": [{"serverName": "a", "serverUrl": "https://x.test"}]}'
    expect(
      lintJson('mcp-policy-entry-schema', code, 'managed-settings.json').map((m) => m.messageId),
    ).toEqual(['keyCount'])
  })
})
