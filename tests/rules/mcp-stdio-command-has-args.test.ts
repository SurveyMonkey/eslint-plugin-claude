// The docs show `command` as the program and `args` as its arguments (MCP quickstart, "Edit
// .mcp.json directly"). The docs do not say that a `command` with a space fails, so the rule is a
// heuristic. `mcp-hidden-whitespace` owns a space at the start or end of `command`.
import { expect, it } from 'vitest'
import {
  ids,
  lintManifest,
  lintPluginFile,
  lintProject,
  mapOf,
} from '../mcp-server-rule.test-support.ts'

const NAME = 'mcp-stdio-command-has-args'
const at = (entry: unknown) => mapOf({ a: entry })

it('reports a command with a space and no args, on the command', () => {
  const code = at({ command: 'npx -y server' })
  const found = lintProject(NAME, code)
  expect(ids(found)).toEqual(['splitCommand'])
  expect(found[0]).toMatchObject({ line: 1, column: code.indexOf('"npx') + 1 })
  expect(found[0]?.message).toContain('"a"')
  expect(found[0]?.message).not.toContain('npx')
})
it('reports with type stdio, with a tab, and with an empty args array', () => {
  expect(ids(lintProject(NAME, at({ type: 'stdio', command: 'node server.js' })))).toEqual([
    'splitCommand',
  ])
  expect(ids(lintProject(NAME, at({ command: 'node\tserver.js' })))).toEqual(['splitCommand'])
  expect(ids(lintProject(NAME, at({ command: 'node server.js', args: [] })))).toEqual([
    'splitCommand',
  ])
})
it('reports in a plugin file and in the servers of a manifest', () => {
  const entry = { command: 'npx -y server' }
  expect(ids(lintPluginFile(NAME, at(entry)))).toEqual(['splitCommand'])
  const manifest = JSON.stringify({ name: 'p', mcpServers: { a: entry } })
  expect(ids(lintManifest(NAME, manifest))).toEqual(['splitCommand'])
  const declared = JSON.stringify({ name: 'p', mcpServers: './s.json' })
  expect(ids(lintManifest(NAME, declared, { 'p/s.json': at(entry) }))).toEqual(['splitCommand'])
})
it('reads the last of two members with one name', () => {
  const code =
    '{"mcpServers": {"a": {"command": "x", "command": "npx -y s", "args": ["a"], "args": []}}}'
  expect(ids(lintProject(NAME, code))).toEqual(['splitCommand'])
  const silent = '{"mcpServers": {"a": {"command": "npx -y s", "command": "npx"}}}'
  expect(ids(lintProject(NAME, silent))).toEqual([])
  const withArgs = '{"mcpServers": {"a": {"command": "npx -y s", "args": [], "args": ["a"]}}}'
  expect(ids(lintProject(NAME, withArgs))).toEqual([])
})

it('stays silent for a command and args', () => {
  expect(ids(lintProject(NAME, at({ command: 'npx', args: ['-y', 'server'] })))).toEqual([])
})
it('stays silent for a command with a space and args', () => {
  expect(ids(lintProject(NAME, at({ command: 'npx -y', args: ['server'] })))).toEqual([])
})
it('stays silent for a command with no space', () => {
  expect(ids(lintProject(NAME, at({ command: 'npx' })))).toEqual([])
  expect(ids(lintProject(NAME, at({ command: '' })))).toEqual([])
})
it('stays silent for a space at the start or end of the command', () => {
  expect(ids(lintProject(NAME, at({ command: ' npx' })))).toEqual([])
  expect(ids(lintProject(NAME, at({ command: 'npx ' })))).toEqual([])
})
it('stays silent for a path that holds a space', () => {
  for (const command of [
    '/opt/my tools/server',
    'C:\\Program Files\\node\\node.exe',
    'C:/Program Files/node/node.exe',
    '\\\\host\\my share\\server.exe',
    ' /opt/my tools/server',
    `\${CLAUDE_PLUGIN_ROOT}/my tools/server`,
    `\${HOME}/Library/Application Support/server`,
  ]) {
    expect(ids(lintProject(NAME, at({ command }))), command).toEqual([])
  }
})
it('stays silent for a remote server', () => {
  expect(
    ids(lintProject(NAME, at({ type: 'http', url: 'https://x.test', command: 'a b' }))),
  ).toEqual([])
  expect(ids(lintProject(NAME, at({ url: 'https://x.test', command: 'a b' })))).toEqual([])
  expect(ids(lintProject(NAME, at({ type: 'sdk', command: 'a b' })))).toEqual([])
})
it('stays silent for a command that is not a string, and an entry that is not an object', () => {
  expect(ids(lintProject(NAME, at({ command: 1 })))).toEqual([])
  expect(ids(lintProject(NAME, at({ command: ['a b'] })))).toEqual([])
  expect(ids(lintProject(NAME, at('a b')))).toEqual([])
  expect(ids(lintProject(NAME, at({ args: ['a b'] })))).toEqual([])
  expect(ids(lintProject(NAME, at({ command: 'a b', args: 'x' })))).toEqual([])
})
it('stays silent for a path Claude Code skips and a file that is not a server map', () => {
  expect(ids(lintProject(NAME, at({ command: 'a b' }), '.claude/mcp.json'))).toEqual([])
  expect(ids(lintProject(NAME, '[]'))).toEqual([])
})
it('reports a command that holds a variable reference after the first word', () => {
  expect(ids(lintProject(NAME, at({ command: `node \${HOME}/server.js` })))).toEqual([
    'splitCommand',
  ])
})
