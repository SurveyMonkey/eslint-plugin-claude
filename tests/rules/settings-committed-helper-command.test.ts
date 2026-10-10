// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '/repo/.claude/settings.json') =>
  lintJson('settings-committed-helper-command', code, filename).map((m) => m.messageId)

describe('settings-committed-helper-command (red)', () => {
  it.fails('reports apiKeyHelper in the shared file', () => {
    expect(ids('{"apiKeyHelper": "/bin/key.sh"}')).toEqual(['helper'])
  })
  it.fails('reports a statusLine command in the shared file', () => {
    expect(ids('{"statusLine": {"type": "command", "command": "~/status.sh"}}')).toEqual(['helper'])
  })
})
