// Red first: the rule does not exist yet, so the case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

describe('mcp-managed-servers-entry (red)', () => {
  it.fails('reports managedMcpServers as an array', () => {
    expect(
      lintJson(
        'mcp-managed-servers-entry',
        '{"managedMcpServers": []}',
        'managed-settings.json',
      ).map((m) => m.messageId),
    ).toEqual(['notObject'])
  })
})
