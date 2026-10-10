// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '/repo/.claude/settings.json') =>
  lintJson('settings-nested-project-file', code, filename).map((m) => m.messageId)

describe('settings-nested-project-file (red)', () => {
  it.fails('reports a project file below the repository root', () => {
    expect(ids('{}', '/repo/pkg/.claude/settings.json')).toEqual(['nested'])
  })
})
