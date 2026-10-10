// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string) =>
  lintJson('mcp-json-servers-key', code, '.mcp.json').map((m) => m.messageId)

describe('mcp-json-servers-key (red)', () => {
  it.fails('reports the VS Code servers key', () => {
    expect(ids('{"servers": {"a": {"command": "x"}}}')).toEqual(['vscodeServers'])
  })
  it.fails('reports a server at the top level', () => {
    expect(ids('{"a": {"command": "x"}}')).toEqual(['unwrapped'])
  })
})
