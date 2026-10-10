// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '/repo/.claude/settings.json') =>
  lintJson('settings-env-context-cost', code, filename).map((m) => m.messageId)

describe('settings-env-context-cost (red)', () => {
  it.fails('reports FORCE_PROMPT_CACHING_5M set on', () => {
    expect(ids('{"env": {"FORCE_PROMPT_CACHING_5M": "1"}}')).toEqual(['fiveMinutes'])
  })
  it.fails('reports ENABLE_TOOL_SEARCH set to false', () => {
    expect(ids('{"env": {"ENABLE_TOOL_SEARCH": "false"}}')).toEqual(['toolSearchOff'])
  })
})
