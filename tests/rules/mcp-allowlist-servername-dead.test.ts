// Red first: the rule does not exist yet, so the case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

describe('mcp-allowlist-servername-dead (red)', () => {
  it.fails('reports a serverName entry of an allowlist with serverUrl and serverCommand entries', () => {
    const code = JSON.stringify({
      allowedMcpServers: [
        { serverUrl: 'https://mcp.example.com/*' },
        { serverCommand: ['npx', 'server'] },
        { serverName: 'github' },
      ],
    })
    expect(
      lintJson('mcp-allowlist-servername-dead', code, 'managed-settings.json').map(
        (m) => m.messageId,
      ),
    ).toEqual(['dead'])
  })
})
