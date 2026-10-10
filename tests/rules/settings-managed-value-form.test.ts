// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '/repo/managed-settings.json') =>
  lintJson('settings-managed-value-form', code, filename).map((m) => m.messageId)

describe('settings-managed-value-form (red)', () => {
  it.fails('reports a quoted Boolean that nothing else checks', () => {
    expect(ids('{"syncClaudeAiPlugins": "false"}')).toEqual(['quotedBoolean'])
  })
  it.fails('reports DISABLE_TELEMETRY with a value that shows the approval dialog', () => {
    expect(ids('{"env": {"DISABLE_TELEMETRY": "0"}}')).toEqual(['approval'])
  })
})
