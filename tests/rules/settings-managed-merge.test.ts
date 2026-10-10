// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '/repo/managed-settings.d/10-a.json') =>
  lintJson('settings-managed-merge', code, filename).map((m) => m.messageId)

describe('settings-managed-merge (red)', () => {
  it.fails('reports merge in a drop-in', () => {
    expect(ids('{"managedSourcesBehavior": "merge"}')).toEqual(['merge'])
  })
  it.fails('stays silent on first-wins', () => {
    expect(ids('{"managedSourcesBehavior": "first-wins"}')).toEqual([])
    expect(ids('{"managedSourcesBehavior": "merge"}')).toEqual(['merge'])
  })
})
