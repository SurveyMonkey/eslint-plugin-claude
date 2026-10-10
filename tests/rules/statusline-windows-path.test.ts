// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (command: string, filename = '/repo/.claude/settings.json') =>
  lintJson(
    'statusline-windows-path',
    JSON.stringify({ statusLine: { type: 'command', command } }),
    filename,
  ).map((m) => m.messageId)

describe('statusline-windows-path (red)', () => {
  it.fails('reports a backslash path', () => {
    expect(ids('node C:\\Users\\me\\status.mjs')).toEqual(['backslash'])
  })
})
