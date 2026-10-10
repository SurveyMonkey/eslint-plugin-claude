// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '/repo/.claude/settings.json') =>
  lintJson('statusline-script-terminal-size', code, filename).map((m) => m.messageId)

describe('statusline-script-terminal-size (red)', () => {
  it.fails('stays silent for a script that is not on disk, and the rule must exist', () => {
    expect(ids('{"statusLine": {"command": ".claude/missing.sh"}}')).toEqual([])
    expect(() =>
      lintJson('statusline-script-terminal-size', '{}', '/repo/.claude/settings.json'),
    ).not.toThrow()
    expect(ids('{}')).toEqual(['tput'])
  })
})
