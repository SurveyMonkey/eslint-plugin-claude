// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '.claude/settings.json') =>
  lintJson('settings-project-autocontinue-off', code, filename).map((m) => m.messageId)

describe('settings-project-autocontinue-off (red)', () => {
  it.fails('reports the key in the project file', () => {
    expect(ids('{"autoContinueAtUsageLimit": false}')).toEqual(['turnsOff'])
  })
  it.fails('reports the key in the local file', () => {
    expect(ids('{"autoContinueAtUsageLimit": true}', '.claude/settings.local.json')).toEqual([
      'turnsOff',
    ])
  })
  it.fails('reports a value that is not a Boolean in a managed file', () => {
    expect(ids('{"autoContinueAtUsageLimit": "no"}', 'managed-settings.json')).toEqual([
      'wrongType',
    ])
  })
})
