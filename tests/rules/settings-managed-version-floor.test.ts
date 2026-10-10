// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '/repo/managed-settings.json') =>
  lintJson('settings-managed-version-floor', code, filename).map((m) => m.messageId)

describe('settings-managed-version-floor (red)', () => {
  it.fails('reports deniedModels without a floor', () => {
    expect(ids('{"deniedModels": ["claude-opus-5-5"]}')).toEqual(['noFloor'])
  })
})
