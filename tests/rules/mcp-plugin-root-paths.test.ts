// The plugin docs show the files of a plugin server through `${CLAUDE_PLUGIN_ROOT}` (MCP page,
// "Plugin-provided MCP servers"). The docs do not say where a plugin server starts. A path that
// starts with `./` or `../` depends on that directory, so the rule is a heuristic. A project
// `.mcp.json` is `mcp-stdio-relative-path`. The rule reads no file on disk.
import { expect, it } from 'vitest'
import {
  ids,
  lintManifest,
  lintPluginFile,
  lintProject,
  mapOf,
} from '../mcp-server-rule.test-support.ts'

const NAME = 'mcp-plugin-root-paths'
const at = (entry: unknown) => mapOf({ a: entry })

it('reports ./server.js in the command, on the string', () => {
  const code = at({ command: './server.js' })
  const found = lintPluginFile(NAME, code)
  expect(ids(found)).toEqual(['relative'])
  expect(found[0]).toMatchObject({ line: 1, column: code.indexOf('"./server.js"') + 1 })
  expect(found[0]?.message).toContain('`command`')
  expect(found[0]?.message).toContain('"a"')
  expect(found[0]?.message).toContain('./server.js')
  expect(found[0]?.message).toContain('CLAUDE_PLUGIN_ROOT')
})
it('reports a ../ path, in the command, each args item and each env value', () => {
  expect(ids(lintPluginFile(NAME, at({ command: '../bin/server' })))).toEqual(['relative'])
  expect(ids(lintPluginFile(NAME, at({ command: 'node', args: ['-c', './config.json'] })))).toEqual(
    ['relative'],
  )
  expect(
    ids(lintPluginFile(NAME, at({ command: 'node', env: { CFG: '../config.json' } }))),
  ).toEqual(['relative'])
})
it('names the field of each report', () => {
  const found = lintPluginFile(NAME, at({ command: './a', args: ['./b'], env: { K: './c' } }))
  expect(found.map((m) => m.message.match(/`(command|args|env)`/)?.[1])).toEqual([
    'command',
    'args',
    'env',
  ])
})
it('reports in a plugin file with no wrapper, and in the servers of a manifest', () => {
  expect(ids(lintPluginFile(NAME, JSON.stringify({ a: { command: './s' } })))).toEqual(['relative'])
  const manifest = JSON.stringify({ name: 'p', mcpServers: { a: { command: './s' } } })
  expect(ids(lintManifest(NAME, manifest))).toEqual(['relative'])
  const declared = JSON.stringify({ name: 'p', mcpServers: './s.json' })
  const found = lintManifest(NAME, declared, { 'p/s.json': at({ command: './s' }) })
  expect(ids(found)).toEqual(['relative'])
  expect(found[0]).toMatchObject({ line: 1, column: declared.indexOf('"./s.json"') + 1 })
})
it('leaves the .mcp.json at the plugin root to its own lint run', () => {
  const root = { 'p/.mcp.json': at({ command: './s' }) }
  expect(ids(lintManifest(NAME, JSON.stringify({ name: 'p' }), root))).toEqual([])
})
it('reads the last of two members with one name', () => {
  const code = '{"a": {"command": "node", "command": "./s"}}'
  expect(ids(lintPluginFile(NAME, code))).toEqual(['relative'])
  expect(ids(lintPluginFile(NAME, '{"a": {"command": "./s", "command": "node"}}'))).toEqual([])
})

it('stays silent for a path from the plugin root variable', () => {
  const root = `\${CLAUDE_PLUGIN_ROOT}`
  expect(
    ids(lintPluginFile(NAME, at({ command: `${root}/server.js`, args: [`${root}/c.json`] }))),
  ).toEqual([])
})
it('stays silent for an absolute path and a bare program name', () => {
  for (const command of ['/usr/bin/node', 'C:\\tools\\node.exe', 'node', 'npx', 'server.js']) {
    expect(
      ids(lintPluginFile(NAME, at({ command, args: [command], env: { K: command } }))),
      command,
    ).toEqual([])
  }
})
it('stays silent for a flag, a package name and a path with a variable', () => {
  const args = ['-y', '--config=./c.json', '@scope/pkg', `\${DIR}/x`, '.hidden', '.', '..', '...']
  expect(ids(lintPluginFile(NAME, at({ command: 'npx', args })))).toEqual([])
})
it('stays silent in the fields that are no file path of the server', () => {
  const entry = { type: 'http', url: './x', headers: { H: './x' }, headersHelper: './helper.sh' }
  expect(ids(lintPluginFile(NAME, at(entry)))).toEqual([])
})
it('stays silent for a project .mcp.json', () => {
  expect(ids(lintProject(NAME, at({ command: './server.js' })))).toEqual([])
})
it('stays silent for a malformed entry', () => {
  expect(ids(lintPluginFile(NAME, at('./x')))).toEqual([])
  expect(ids(lintPluginFile(NAME, at({ command: 1, args: './x', env: [] })))).toEqual([])
  expect(
    ids(lintPluginFile(NAME, at({ command: 'node', args: [1, null], env: { K: 1 } }))),
  ).toEqual([])
  expect(ids(lintPluginFile(NAME, '[]'))).toEqual([])
})
it('stays silent for a manifest with no mcpServers, and a declared file that is missing', () => {
  expect(ids(lintManifest(NAME, JSON.stringify({ name: 'p' })))).toEqual([])
  const declared = JSON.stringify({ name: 'p', mcpServers: './missing.json' })
  expect(ids(lintManifest(NAME, declared))).toEqual([])
})
