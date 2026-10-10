// Red first: the rule does not exist yet, so the case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

describe('mcp-env-client-secret (red)', () => {
  it.fails('reports MCP_CLIENT_SECRET in the env of the committed settings file', () => {
    const code = '{"env": {"MCP_CLIENT_SECRET": "s3cret"}}'
    expect(
      lintJson('mcp-env-client-secret', code, '.claude/settings.json').map((m) => m.messageId),
    ).toEqual(['secret'])
  })
})
