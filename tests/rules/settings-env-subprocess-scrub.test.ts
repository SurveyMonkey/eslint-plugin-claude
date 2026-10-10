// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '/repo/.claude/settings.json') =>
  lintJson('settings-env-subprocess-scrub', code, filename).map((m) => m.messageId)

describe('settings-env-subprocess-scrub (red)', () => {
  it.fails('reports a file with no CLAUDE_CODE_SUBPROCESS_ENV_SCRUB', () => {
    expect(ids('{}')).toEqual(['scrub'])
  })
  it.fails('stays silent when the variable is 1', () => {
    expect(ids('{"env": {"CLAUDE_CODE_SUBPROCESS_ENV_SCRUB": "1"}}')).toEqual([])
    expect(ids('{}')).toEqual(['scrub'])
  })
})
