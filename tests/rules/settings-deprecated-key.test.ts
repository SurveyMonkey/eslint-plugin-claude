// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '.claude/settings.json') =>
  lintJson('settings-deprecated-key', code, filename).map((m) => m.messageId)

describe('settings-deprecated-key (red)', () => {
  it.fails('reports includeCoAuthoredBy that nothing replaces', () => {
    expect(ids('{"includeCoAuthoredBy": false}')).toEqual(['deprecated'])
  })
  it.fails('reports voiceEnabled that nothing replaces', () => {
    expect(ids('{"voiceEnabled": true}')).toEqual(['deprecated'])
  })
  it.fails('reports disableArtifact true', () => {
    expect(ids('{"disableArtifact": true}')).toEqual(['deprecated'])
  })
  it.fails('reports a key in a managed file', () => {
    expect(ids('{"voiceEnabled": true}', 'managed-settings.json')).toEqual(['deprecated'])
  })
})
