// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '/repo/.claude/settings.json') =>
  lintJson('settings-worktree-sparse-claude-dir', code, filename).map((m) => m.messageId)

describe('settings-worktree-sparse-claude-dir (red)', () => {
  it.fails('reports a list with no .claude', () => {
    expect(ids('{"worktree": {"sparsePaths": ["packages/api"]}}')).toEqual(['omitted'])
  })
})
