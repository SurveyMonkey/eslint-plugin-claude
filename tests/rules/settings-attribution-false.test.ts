// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '.claude/settings.json') =>
  lintJson('settings-attribution-false', code, filename).map((m) => m.messageId)

describe('settings-attribution-false (red)', () => {
  it.fails('reports attribution false in the project file', () => {
    expect(ids('{"attribution": false}')).toEqual(['older'])
  })
  it.fails('reports attribution false in the local file', () => {
    expect(ids('{"attribution": false}', '.claude/settings.local.json')).toEqual(['older'])
  })
})
