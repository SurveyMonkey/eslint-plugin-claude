// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '/repo/.claude/settings.json') =>
  lintJson('settings-env-format-heuristic', code, filename).map((m) => m.messageId)

describe('settings-env-format-heuristic (red)', () => {
  it.fails('reports a MAX_MCP_OUTPUT_TOKENS value that is not a positive integer', () => {
    expect(ids('{"env": {"MAX_MCP_OUTPUT_TOKENS": "0"}}')).toEqual(['badForm'])
  })
  it.fails('reports a CLAUDE_CODE_USE_POWERSHELL_TOOL value other than 0 or 1', () => {
    expect(ids('{"env": {"CLAUDE_CODE_USE_POWERSHELL_TOOL": "true"}}')).toEqual(['badForm'])
  })
})
