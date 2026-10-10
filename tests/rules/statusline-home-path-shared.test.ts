// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '/repo/.claude/settings.json') =>
  lintJson('statusline-home-path-shared', code, filename).map((m) => m.messageId)

describe('statusline-home-path-shared (red)', () => {
  it.fails('reports a command in the home .claude folder', () => {
    expect(ids('{"statusLine": {"command": "~/.claude/statusline.sh"}}')).toEqual(['home'])
  })
  it.fails('stays silent for a repository path', () => {
    expect(ids('{"statusLine": {"command": ".claude/statusline.sh"}}')).toEqual([])
    expect(ids('{"statusLine": {"command": "~/.claude/s.sh"}}')).toEqual(['home'])
  })
})
