// A name in `enabledMcpjsonServers` or `disabledMcpjsonServers` is a server of the project
// `.mcp.json`, "the server names as they appear in `.mcp.json`" (settings reference). The rule
// reads `.mcp.json` beside the `.claude/` folder of the settings file. The files are on disk, so
// the cases use `Linter` and a repository with a `.git` directory.
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const NAME = 'mcp-approval-names-exist'
const mcp = (...names: string[]) =>
  JSON.stringify({ mcpServers: Object.fromEntries(names.map((n) => [n, { command: 'x' }])) })
const lists = (enabled?: string[], disabled?: string[]) =>
  JSON.stringify({ enabledMcpjsonServers: enabled, disabledMcpjsonServers: disabled })

/** Lint `code` as `file` of a repository with `files`. */
function lint(code: string, files: Record<string, string>, file = '.claude/settings.json') {
  return lintJson(NAME, code, path.join(repo(files), file))
}
const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

it('reports a name that .mcp.json does not declare, on the name', () => {
  const found = lint(lists(['db', 'gone']), { '.mcp.json': mcp('db') })
  expect(ids(found)).toEqual(['unknown'])
  expect(found[0]).toMatchObject({ line: 1, column: 32, endColumn: 38 })
  expect(found[0]?.message).toContain('"gone"')
  expect(found[0]?.message).toContain('enabledMcpjsonServers')
})
it('reports in both lists, and in the local file and a nested project', () => {
  const files = { '.mcp.json': mcp('db'), 'packages/a/.mcp.json': mcp('web') }
  expect(ids(lint(lists(['x'], ['y']), files))).toEqual(['unknown', 'unknown'])
  expect(ids(lint(lists(['x']), files, '.claude/settings.local.json'))).toEqual(['unknown'])
  // The project of `packages/a/.claude` is `packages/a`, and `web` is its server.
  expect(ids(lint(lists(['web', 'db']), files, 'packages/a/.claude/settings.json'))).toEqual([
    'unknown',
  ])
})
it('stays silent for names that .mcp.json declares', () => {
  expect(ids(lint(lists(['db'], ['web']), { '.mcp.json': mcp('db', 'web') }))).toEqual([])
})
it('stays silent when there is no .mcp.json, or the rule cannot read it', () => {
  expect(ids(lint(lists(['db']), {}))).toEqual([])
  expect(ids(lint(lists(['db']), { '.mcp.json': '{ not json' }))).toEqual([])
  // `mcp-json-servers-key` owns a file with no `mcpServers` object.
  expect(ids(lint(lists(['db']), { '.mcp.json': '{"servers": {"a": {}}}' }))).toEqual([])
  expect(ids(lint(lists(['db']), { '.mcp.json': '{"mcpServers": []}' }))).toEqual([])
  expect(ids(lint(lists(['db']), { '.mcp.json': '[]' }))).toEqual([])
  // The server file in `.claude/` is not read by Claude Code.
  expect(ids(lint(lists(['db']), { '.claude/.mcp.json': mcp('x') }))).toEqual([])
})
it('stays silent for a .mcp.json that is a link out of the repository, or dangling', () => {
  const root = repo({})
  const outside = mkdtempSync(path.join(tmpdir(), 'mcp-approval-outside-'))
  try {
    writeFileSync(path.join(outside, 'mcp.json'), mcp('other'))
    const at = path.join(root, '.claude', 'settings.json')
    symlinkSync(path.join(outside, 'mcp.json'), path.join(root, '.mcp.json'))
    expect(ids(lintJson(NAME, lists(['db']), at))).toEqual([])
    rmSync(path.join(root, '.mcp.json'))
    symlinkSync(path.join(root, 'nothing.json'), path.join(root, '.mcp.json'))
    expect(ids(lintJson(NAME, lists(['db']), at))).toEqual([])
  } finally {
    rmSync(outside, { recursive: true, force: true })
  }
})
it('reads the last of two list keys, and skips values it cannot read', () => {
  const files = { '.mcp.json': mcp('db') }
  const twice = '{"enabledMcpjsonServers": ["x"], "enabledMcpjsonServers": ["db"]}'
  expect(ids(lint(twice, files))).toEqual([])
  const last = '{"enabledMcpjsonServers": ["db"], "enabledMcpjsonServers": ["x"]}'
  expect(ids(lint(last, files))).toEqual(['unknown'])
  expect(ids(lint('{"enabledMcpjsonServers": "x"}', files))).toEqual([])
  expect(ids(lint('{"enabledMcpjsonServers": [1, null, ["x"]]}', files))).toEqual([])
  expect(ids(lint('[]', files))).toEqual([])
  expect(ids(lint('{"model": "x"}', files))).toEqual([])
})
