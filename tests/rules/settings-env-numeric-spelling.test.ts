// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '/repo/.claude/settings.json') =>
  lintJson('settings-env-numeric-spelling', code, filename).map((m) => m.messageId)

describe('settings-env-numeric-spelling (red)', () => {
  it.fails('reports a scientific spelling', () => {
    expect(ids('{"env": {"API_TIMEOUT_MS": "1e6"}}')).toEqual(['spelling'])
  })
  it.fails('reports a digit separator', () => {
    expect(ids('{"env": {"MAX_THINKING_TOKENS": "64_000"}}')).toEqual(['spelling'])
  })
})
