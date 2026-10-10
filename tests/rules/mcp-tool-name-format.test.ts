// Red first: the rule does not exist yet, so the case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

describe('mcp-tool-name-format (red)', () => {
  it.fails('reports a tool reference that is not in the mcp__ form', () => {
    const code = '{"permissions": {"allow": ["mcp_server_tool"]}}'
    expect(
      lintJson('mcp-tool-name-format', code, '.claude/settings.json').map((m) => m.messageId),
    ).toEqual(['format'])
  })
})
