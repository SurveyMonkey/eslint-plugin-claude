// A server name has letters, numbers, hyphens and underscores only. `claude mcp` commands and the
// Claude Desktop import reject other names, and the tool name of a plugin server replaces them
// with `_`. The rule skips a reserved name in a `.mcp.json`, which `mcp-server-name-reserved`
// reports there.
import { expect, it } from 'vitest'
import {
  ids,
  lintManifest,
  lintPluginFile,
  lintProject,
  mapOf,
} from '../mcp-server-rule.test-support.ts'

const NAME = 'mcp-server-name-format'
const server = { command: 'node' }
const named = (...names: string[]) => mapOf(Object.fromEntries(names.map((n) => [n, server])))
const manifest = (mcpServers: unknown) => JSON.stringify({ name: 'p', mcpServers })

it('reports a space and a dot in a project file, on the name', () => {
  const found = lintProject(NAME, named('my server', 'a.b'))
  expect(ids(found)).toEqual(['format', 'format'])
  expect(found[0]).toMatchObject({ line: 1, column: 16, endColumn: 27 })
  expect(found[0]?.message).toContain('"my server"')
})
it('stays silent for letters, numbers, hyphens and underscores', () => {
  expect(ids(lintProject(NAME, named('my-server_1', 'A', '9')))).toEqual([])
})
it('reports an empty name', () => {
  expect(ids(lintProject(NAME, named('')))).toEqual(['format'])
})
it('reads a project file with no wrapper as no map', () => {
  expect(ids(lintProject(NAME, JSON.stringify({ 'a.b': server })))).toEqual([])
})
it('reads the last of two members with one name', () => {
  expect(ids(lintProject(NAME, '{"mcpServers": {"a.b": {}, "a.b": {}}}'))).toEqual(['format'])
})
it('stays silent for a map or a file that is not an object', () => {
  expect(ids(lintProject(NAME, '{"mcpServers": []}'))).toEqual([])
  expect(ids(lintProject(NAME, '[]'))).toEqual([])
})
it('skips the reserved names, which mcp-server-name-reserved reports', () => {
  expect(ids(lintProject(NAME, named('Claude Preview', 'Claude Browser', 'workspace')))).toEqual([])
})
it('reports a near miss of a reserved name, which the reserved rule does not report', () => {
  const found = lintProject(NAME, named('claude preview', 'Claude Preview ', 'Claude  Browser'))
  expect(ids(found)).toEqual(['format', 'format', 'format'])
})
it('reports a reserved name with a space in plugin.json, which no other rule reports', () => {
  const found = lintManifest(NAME, manifest({ 'Claude Preview': server, workspace: server }))
  expect(ids(found)).toEqual(['format'])
  expect(found[0]?.message).toContain('"Claude Preview"')
})
it('does not read a path under .claude/', () => {
  expect(ids(lintProject(NAME, named('a.b'), '.claude/.mcp.json'))).toEqual([])
})
it('reports in a plugin file, with and without the wrapper', () => {
  expect(ids(lintPluginFile(NAME, named('a.b')))).toEqual(['format'])
  expect(ids(lintPluginFile(NAME, JSON.stringify({ 'a.b': server })))).toEqual(['format'])
  expect(ids(lintPluginFile(NAME, named('a_b')))).toEqual([])
})
it('reports an inline manifest server on its name', () => {
  const found = lintManifest(NAME, manifest({ 'a.b': server, ok: server }))
  expect(ids(found)).toEqual(['format'])
  expect(found[0]).toMatchObject({ line: 1, column: 27, endColumn: 32 })
})
it('reports a server of a declared file on the path in the manifest', () => {
  const found = lintManifest(NAME, manifest('./mcp/servers.json'), {
    'p/mcp/servers.json': named('a.b'),
  })
  expect(ids(found)).toEqual(['format'])
  expect(found[0]).toMatchObject({ line: 1, column: 26, endColumn: 46 })
  expect(found[0]?.message).toContain('"a.b"')
})
it('leaves the .mcp.json at the plugin root to its own lint', () => {
  expect(ids(lintManifest(NAME, manifest({}), { 'p/.mcp.json': named('a.b') }))).toEqual([])
})
it('stays silent for a manifest with nothing that it can read', () => {
  expect(ids(lintManifest(NAME, '{"name": "p"}'))).toEqual([])
  expect(ids(lintManifest(NAME, manifest('./missing.json')))).toEqual([])
  expect(ids(lintManifest(NAME, manifest('./b.mcpb'), { 'p/b.mcpb': named('a.b') }))).toEqual([])
})
