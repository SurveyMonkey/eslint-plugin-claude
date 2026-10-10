// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '/repo/.claude/settings.json') =>
  lintJson('settings-env-routing', code, filename).map((m) => m.messageId)

describe('settings-env-routing (red)', () => {
  it.fails('reports HTTPS_PROXY', () => {
    expect(ids('{"env": {"HTTPS_PROXY": "http://proxy.example.com:3128"}}')).toEqual(['traffic'])
  })
  it.fails('reports CLAUDE_CODE_USE_BEDROCK set to 1', () => {
    expect(ids('{"env": {"CLAUDE_CODE_USE_BEDROCK": "1"}}')).toEqual(['bypass'])
  })
  it.fails('reports a non-default ANTHROPIC_BASE_URL', () => {
    expect(ids('{"env": {"ANTHROPIC_BASE_URL": "https://gateway.example.com"}}')).toEqual([
      'bypass',
    ])
  })
})
