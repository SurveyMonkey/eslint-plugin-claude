// A plugin declares each MCP server name once (plugin manifest reference, "mcpServers"). Claude
// Code loads `.mcp.json` at the plugin root first, then each `mcpServers` value in order, and a
// later server of one name replaces an earlier one. The files are on disk, so the cases use
// `Linter` and a repository with a `.git` directory.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { chmodCannotBlock, lintJson, withoutAccess } from '../rule-tester.test-support.ts'

const NAME = 'mcp-duplicate-server-name'
const server = { command: 'node' }
const inline = (...names: string[]) => Object.fromEntries(names.map((n) => [n, server]))
const servers = (...names: string[]) => JSON.stringify({ mcpServers: inline(...names) })
const manifest = (mcpServers: unknown) => JSON.stringify({ name: 'p', mcpServers })

/** Lint `code` as the manifest of the plugin `p` in a repository with `files`. */
function lint(code: string, files: Record<string, string> = {}) {
  const root = repo(files)
  return lintJson(NAME, code, path.join(root, 'p', '.claude-plugin', 'plugin.json'))
}
const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

it('reports a name that .mcp.json and an inline map both declare, on the inline name', () => {
  const found = lint(manifest(inline('db', 'web')), { 'p/.mcp.json': servers('db') })
  expect(ids(found)).toEqual(['duplicate'])
  expect(found[0]).toMatchObject({ line: 1, column: 27, endColumn: 31 })
  expect(found[0]?.message).toContain('"db"')
  expect(found[0]?.message).toContain('.mcp.json')
})
it('reads a .mcp.json with no mcpServers wrapper', () => {
  const found = lint(manifest(inline('db')), { 'p/.mcp.json': JSON.stringify({ db: server }) })
  expect(ids(found)).toEqual(['duplicate'])
})
it('reports a name in two inline maps of one array', () => {
  const found = lint(manifest([inline('a', 'db'), inline('db', 'b')]))
  expect(ids(found)).toEqual(['duplicate'])
  expect(found[0]?.message).toContain('an inline map')
})
it('reports each repeated name', () => {
  expect(ids(lint(manifest([inline('a', 'b'), inline('a', 'b')])))).toEqual([
    'duplicate',
    'duplicate',
  ])
})
it('stays silent for distinct names', () => {
  expect(ids(lint(manifest(inline('db', 'web')), { 'p/.mcp.json': servers('a') }))).toEqual([])
})
it('counts a key that one file repeats as one server', () => {
  // `JSON.parse` keeps the last of two keys, so the file declares one server.
  const twice = '{"name": "p", "mcpServers": {"db": {"command": "a"}, "db": {"command": "b"}}}'
  expect(ids(lint(twice))).toEqual([])
  const file = '{"mcpServers": {"db": {"command": "a"}, "db": {"command": "b"}}}'
  expect(ids(lint(manifest(inline('x')), { 'p/.mcp.json': file }))).toEqual([])
})
it('reads the last of two mcpServers members', () => {
  const files = { 'p/.mcp.json': servers('db') }
  expect(ids(lint('{"mcpServers": {"x": {}}, "mcpServers": {"db": {}}}', files))).toEqual([
    'duplicate',
  ])
  expect(ids(lint('{"mcpServers": {"db": {}}, "mcpServers": {"x": {}}}', files))).toEqual([])
})
it('stays silent when the manifest declares nothing that it can read', () => {
  const files = { 'p/.mcp.json': servers('db') }
  expect(ids(lint('{"name": "p"}', files))).toEqual([])
  expect(ids(lint('[]', files))).toEqual([])
  expect(ids(lint(manifest(7), files))).toEqual([])
  expect(ids(lint(manifest([7, null, ['./a.json']]), files))).toEqual([])
  expect(ids(lint('{"mcpServers": {"db": 1}}', { 'p/.mcp.json': '[]' }))).toEqual([])
})

it('reports a name that a .json file and .mcp.json both declare, on the path', () => {
  const found = lint(manifest('./mcp/servers.json'), {
    'p/.mcp.json': servers('db'),
    'p/mcp/servers.json': servers('db'),
  })
  expect(ids(found)).toEqual(['duplicate'])
  expect(found[0]).toMatchObject({ line: 1, column: 26, endColumn: 46 })
  expect(found[0]?.message).toContain('.mcp.json')
})
it('reports a name in two declared files, and in a file and an inline map after it', () => {
  const files = { 'p/a.json': servers('db'), 'p/b.json': JSON.stringify({ db: server }) }
  const two = lint(manifest(['./a.json', './b.json']), files)
  expect(ids(two)).toEqual(['duplicate'])
  expect(two[0]?.message).toContain('./a.json')
  expect(ids(lint(manifest(['./a.json', inline('db')]), files))).toEqual(['duplicate'])
})
it('reports the declaration that comes later, whichever kind it is', () => {
  const files = { 'p/a.json': servers('db') }
  const found = lint(manifest([inline('db'), './a.json']), files)
  expect(ids(found)).toEqual(['duplicate'])
  expect(found[0]?.message).toContain('an inline map')
})
it('does not read a bundle, a URL, a path with .., or a path that is not .json', () => {
  const files = {
    'p/.mcp.json': servers('db'),
    'p/b.mcpb': servers('db'),
    'p/x.txt': servers('db'),
    'p/servers.json': servers('db'),
  }
  for (const declared of [
    './b.mcpb',
    'https://example.com/server.mcpb',
    '../p/.mcp.json',
    './x.txt',
    '/abs/servers.json',
    'servers.json',
    '.\\servers.json',
  ]) {
    expect(ids(lint(manifest(declared), files))).toEqual([])
  }
})
it('stays silent for a file that is not there, or does not parse', () => {
  const files = { 'p/.mcp.json': servers('db'), 'p/bad.json': '{ not json' }
  expect(ids(lint(manifest('./missing.json'), files))).toEqual([])
  expect(ids(lint(manifest('./bad.json'), files))).toEqual([])
  expect(ids(lint(manifest(inline('db')), { 'p/.mcp.json': '{ not json' }))).toEqual([])
})
it('stays silent for a link that leads out of the plugin or out of the repository', () => {
  const root = repo({ 'p/.mcp.json': servers('db'), 'other/servers.json': servers('db') })
  const outside = mkdtempSync(path.join(tmpdir(), 'mcp-dup-outside-'))
  try {
    writeFileSync(path.join(outside, 'servers.json'), servers('db'))
    symlinkSync(path.join(root, 'other', 'servers.json'), path.join(root, 'p', 'in-repo.json'))
    symlinkSync(path.join(root, 'nothing.json'), path.join(root, 'p', 'dangling.json'))
    symlinkSync(path.join(outside, 'servers.json'), path.join(root, 'p', 'out.json'))
    const at = path.join(root, 'p', '.claude-plugin', 'plugin.json')
    for (const declared of ['./in-repo.json', './dangling.json', './out.json']) {
      expect(ids(lintJson(NAME, manifest(declared), at))).toEqual([])
    }
    // A link to a file in the plugin still loads.
    symlinkSync(path.join(root, 'p', '.mcp.json'), path.join(root, 'p', 'same.json'))
    expect(ids(lintJson(NAME, manifest('./same.json'), at))).toEqual(['duplicate'])
  } finally {
    rmSync(outside, { recursive: true, force: true })
  }
})
it('does not follow a plugin directory that is a link out of the repository', () => {
  const outside = mkdtempSync(path.join(tmpdir(), 'mcp-dup-plugin-'))
  try {
    mkdirSync(path.join(outside, '.claude-plugin'), { recursive: true })
    writeFileSync(path.join(outside, '.mcp.json'), servers('db'))
    const root = repo({})
    symlinkSync(outside, path.join(root, 'p'))
    const at = path.join(root, 'p', '.claude-plugin', 'plugin.json')
    expect(ids(lintJson(NAME, manifest(inline('db')), at))).toEqual([])
  } finally {
    rmSync(outside, { recursive: true, force: true })
  }
})
it('keeps the report that the readable files support when one file is locked', () => {
  const root = repo({
    'p/.mcp.json': servers('db'),
    'p/locked.json': servers('db'),
    'p/ok.json': servers('db'),
  })
  const at = path.join(root, 'p', '.claude-plugin', 'plugin.json')
  const code = manifest(['./locked.json', './ok.json'])
  if (chmodCannotBlock) {
    return
  }
  const found = withoutAccess(path.join(root, 'p', 'locked.json'), () => lintJson(NAME, code, at))
  expect(ids(found)).toEqual(['duplicate'])
  expect(found[0]?.message).toContain('.mcp.json')
})
