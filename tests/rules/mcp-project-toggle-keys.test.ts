// `disabledMcpServers` and `enabledMcpServers` are per-project lists that Claude Code writes to
// `~/.claude.json` when a person toggles a server in the `/mcp` panel (MCP page, "Disable a server
// without removing it"). The settings reference lists no such key. The files glob is in
// tests/configs.test.ts.
import { expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const NAME = 'mcp-project-toggle-keys'
const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)
const project = '/p/.claude/settings.json'

it.fails('reports each toggle key, on the key', () => {
  const found = lintJson(NAME, '{"disabledMcpServers": ["a"]}', project)
  expect(ids(found)).toEqual(['toggle'])
  expect(found[0]).toMatchObject({ line: 1, column: 2, endColumn: 22 })
  expect(found[0]?.message).toContain('"disabledMcpServers"')
  expect(found[0]?.message).toContain('~/.claude.json')
  expect(found[0]?.message).toContain('enabledMcpjsonServers')
  const enabled = lintJson(NAME, '{"enabledMcpServers": ["computer-use"]}', project)
  expect(enabled[0]).toMatchObject({ line: 1, column: 2, endColumn: 21 })
  expect(
    ids(lintJson(NAME, '{"enabledMcpServers": [], "disabledMcpServers": []}', project)),
  ).toEqual(['toggle', 'toggle'])
})
it.fails('reports in the local file, the managed file and a drop-in', () => {
  const code = '{"disabledMcpServers": []}'
  for (const file of [
    '/p/.claude/settings.local.json',
    '/p/managed-settings.json',
    '/p/managed-settings.d/10-a.json',
  ]) {
    expect(ids(lintJson(NAME, code, file)), file).toEqual(['toggle'])
  }
})
it.fails('reports a key once, also when the value is not a list', () => {
  expect(ids(lintJson(NAME, '{"disabledMcpServers": "a"}', project))).toEqual(['toggle'])
  expect(
    ids(lintJson(NAME, '{"disabledMcpServers": [], "disabledMcpServers": []}', project)),
  ).toEqual(['toggle'])
})
it.fails('stays silent for the approval keys, other keys and a key below the top level', () => {
  for (const code of [
    '{"disabledMcpjsonServers": ["a"], "enabledMcpjsonServers": ["b"]}',
    '{"env": {"disabledMcpServers": "x"}}',
    '{"permissions": {"disabledMcpServers": []}}',
    '{"DisabledMcpServers": []}',
    '{"model": "x"}',
    '[]',
  ]) {
    expect(ids(lintJson(NAME, code, project)), code).toEqual([])
  }
})
it.fails('stays silent in a hidden drop-in', () => {
  expect(
    ids(lintJson(NAME, '{"disabledMcpServers": []}', '/p/managed-settings.d/.10.json')),
  ).toEqual([])
})
