// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '/repo/managed-settings.json') =>
  lintJson('settings-managed-effort-cap', code, filename).map((m) => m.messageId)

describe('settings-managed-effort-cap (red)', () => {
  it.fails('reports effortLevel without maxEffortLevel', () => {
    expect(ids('{"effortLevel": "high"}')).toEqual(['uncapped'])
  })
  it.fails('stays silent with maxEffortLevel', () => {
    expect(ids('{"effortLevel": "high", "maxEffortLevel": "high"}')).toEqual([])
    expect(ids('{"effortLevel": "high"}')).toEqual(['uncapped'])
  })
})
