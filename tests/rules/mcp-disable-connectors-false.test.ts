// Red first: the rule does not exist yet, so the case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

describe('mcp-disable-connectors-false (red)', () => {
  it.fails('reports false in a managed file', () => {
    const code = '{"disableClaudeAiConnectors": false}'
    expect(
      lintJson('mcp-disable-connectors-false', code, 'managed-settings.json').map(
        (m) => m.messageId,
      ),
    ).toEqual(['unset'])
  })
})
