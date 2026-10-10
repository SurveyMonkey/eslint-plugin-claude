// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '/repo/.claude/settings.json') =>
  lintJson('settings-worktree-paths', code, filename).map((m) => m.messageId)

describe('settings-worktree-paths (red)', () => {
  it.fails('reports a leading slash', () => {
    expect(ids('{"worktree": {"symlinkDirectories": ["/node_modules"]}}')).toEqual(['absolute'])
  })
  it.fails('reports a parent segment', () => {
    expect(ids('{"worktree": {"sparsePaths": ["../x"]}}')).toEqual(['parent'])
  })
})
