// Red first: the rule does not exist yet, so the case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

describe('mcp-approval-committed (red)', () => {
  it.fails('reports a committed approval of every project server', () => {
    const code = '{"enableAllProjectMcpServers": true}'
    expect(
      lintJson('mcp-approval-committed', code, '.claude/settings.json').map((m) => m.messageId),
    ).toEqual(['committed'])
  })
})
