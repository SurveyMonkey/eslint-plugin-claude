// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '/repo/.claude/settings.json') =>
  lintJson('settings-env-deprecated-var', code, filename).map((m) => m.messageId)

describe('settings-env-deprecated-var (red)', () => {
  it.fails('reports ANTHROPIC_SMALL_FAST_MODEL', () => {
    expect(ids('{"env": {"ANTHROPIC_SMALL_FAST_MODEL": "haiku"}}')).toEqual(['deprecated'])
  })
  it.fails('reports CLAUDE_CODE_ENABLE_TASKS set to 0 in a managed file', () => {
    expect(
      ids('{"env": {"CLAUDE_CODE_ENABLE_TASKS": "0"}}', '/repo/managed-settings.json'),
    ).toEqual(['deprecated'])
  })
})
