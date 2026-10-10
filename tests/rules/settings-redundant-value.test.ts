// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '.claude/settings.json') =>
  lintJson('settings-redundant-value', code, filename).map((m) => m.messageId)

describe('settings-redundant-value (red)', () => {
  it.fails('reports alwaysThinkingEnabled true', () => {
    expect(ids('{"alwaysThinkingEnabled": true}')).toEqual(['sameAsUnset'])
  })
  it.fails('reports enableArtifact true', () => {
    expect(ids('{"enableArtifact": true}')).toEqual(['sameAsUnset'])
  })
  it.fails('reports syncClaudeAiSkills true in the local file', () => {
    expect(ids('{"syncClaudeAiSkills": true}', '.claude/settings.local.json')).toEqual([
      'sameAsUnset',
    ])
  })
  it.fails('reports syncClaudeAiPlugins true in a managed file', () => {
    expect(ids('{"syncClaudeAiPlugins": true}', 'managed-settings.json')).toEqual(['sameAsUnset'])
  })
  it.fails('reports spinnerVerbs replace with no verbs', () => {
    expect(ids('{"spinnerVerbs": {"mode": "replace", "verbs": []}}')).toEqual(['emptyReplace'])
  })
})
