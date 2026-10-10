// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '/repo/.claude/settings.json') =>
  lintJson('settings-env-secret-heuristic', code, filename).map((m) => m.messageId)

describe('settings-env-secret-heuristic (red)', () => {
  it.fails('reports a name that ends in _TOKEN', () => {
    expect(ids('{"env": {"MY_TOKEN": "abc"}}')).toEqual(['name'])
  })
  it.fails('reports a value that starts with sk-ant-', () => {
    expect(ids('{"env": {"MY_VAR": "sk-ant-abc123"}}')).toEqual(['value'])
  })
})
