// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '.claude/settings.json') =>
  lintJson('settings-outputstyle-resolves', code, filename).map((m) => m.messageId)

describe('settings-outputstyle-resolves (red)', () => {
  it.fails('reports a style that no built-in or custom style has', () => {
    expect(ids('{"outputStyle": "Nope"}')).toEqual(['unknown'])
  })
  it.fails('reports a style in the wrong letter case', () => {
    expect(ids('{"outputStyle": "explanatory"}')).toEqual(['caseMismatch'])
  })
})
