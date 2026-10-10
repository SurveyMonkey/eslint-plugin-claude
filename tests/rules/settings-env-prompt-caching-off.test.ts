// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '/repo/.claude/settings.json') =>
  lintJson('settings-env-prompt-caching-off', code, filename).map((m) => m.messageId)

describe('settings-env-prompt-caching-off (red)', () => {
  it.fails('reports DISABLE_PROMPT_CACHING set to 1', () => {
    expect(ids('{"env": {"DISABLE_PROMPT_CACHING": "1"}}')).toEqual(['off'])
  })
  it.fails('reports DISABLE_PROMPT_CACHING_OPUS set to 1', () => {
    expect(ids('{"env": {"DISABLE_PROMPT_CACHING_OPUS": "1"}}')).toEqual(['off'])
  })
})
