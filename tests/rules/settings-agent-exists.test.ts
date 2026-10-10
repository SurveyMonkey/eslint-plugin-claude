// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '/repo/.claude/settings.json') =>
  lintJson('settings-agent-exists', code, filename).map((m) => m.messageId)

describe('settings-agent-exists (red)', () => {
  it.fails('reports an agent name that nothing defines', () => {
    expect(ids('{"agent": "nobody"}')).toEqual(['unknown'])
  })
})
