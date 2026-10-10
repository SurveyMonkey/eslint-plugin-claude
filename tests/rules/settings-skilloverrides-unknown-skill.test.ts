// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '/repo/.claude/settings.json') =>
  lintJson('settings-skilloverrides-unknown-skill', code, filename).map((m) => m.messageId)

describe('settings-skilloverrides-unknown-skill (red)', () => {
  it.fails('reports a key that matches no skill', () => {
    expect(ids('{"skillOverrides": {"nothing": "off"}}')).toEqual(['unknown'])
  })
})
