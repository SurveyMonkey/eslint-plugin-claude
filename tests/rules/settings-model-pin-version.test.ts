// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '/repo/.claude/settings.json') =>
  lintJson('settings-model-pin-version', code, filename).map((m) => m.messageId)

describe('settings-model-pin-version (red)', () => {
  it.fails('reports an alias in the shared file', () => {
    expect(ids('{"model": "opus"}')).toEqual(['alias'])
  })
  it.fails('reports an availableModels entry without the provider prefix', () => {
    expect(
      ids('{"env": {"CLAUDE_CODE_USE_BEDROCK": "1"}, "availableModels": ["claude-opus-4-8"]}'),
    ).toEqual(['noPrefix'])
  })
})
