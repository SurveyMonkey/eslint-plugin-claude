// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '/repo/.claude/settings.json') =>
  lintJson('settings-model-capability', code, filename).map((m) => m.messageId)

describe('settings-model-capability (red)', () => {
  it.fails('reports [1m] on a model without 1M context', () => {
    expect(ids('{"model": "claude-sonnet-4-5[1m]"}')).toEqual(['noMillion'])
  })
  it.fails('reports alwaysThinkingEnabled false with an always-thinking model', () => {
    expect(ids('{"model": "claude-opus-5-5", "alwaysThinkingEnabled": false}')).toEqual([
      'thinkingOff',
    ])
  })
})
