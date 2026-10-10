// A `headersHelper` runs in a shell. Its working directory depends on where the server is
// configured, so the command needs an absolute path or a name on `PATH`.
import { expect, it } from 'vitest'
import {
  ids,
  lintManifest,
  lintPluginFile,
  lintProject,
  mapOf,
} from '../mcp-server-rule.test-support.ts'

const NAME = 'mcp-headershelper-path'
const entry = (headersHelper: unknown) =>
  mapOf({ a: { type: 'http', url: 'https://x.test/mcp', headersHelper } })
const PLUGIN_ROOT = `\${CLAUDE_PLUGIN_ROOT}/h.sh`
const manifest = (mcpServers: unknown) => JSON.stringify({ name: 'p', mcpServers })

it('reports a relative path in a project file, on the value', () => {
  const found = lintProject(NAME, entry('./h.sh'))
  expect(ids(found)).toEqual(['relative'])
  expect(found[0]).toMatchObject({ line: 1, column: 78, endColumn: 86 })
  expect(found[0]?.message).toContain('"a"')
  expect(found[0]?.message).toContain('./h.sh')
})
it('reports ../, a path with a folder, and a path with arguments', () => {
  for (const helper of ['../h.sh', 'scripts/h.sh', './h.sh --flag', '  ./h.sh', '"./h.sh" x']) {
    expect(ids(lintProject(NAME, entry(helper)))).toEqual(['relative'])
  }
})
it('stays silent for an absolute path and a bare command', () => {
  for (const helper of ['/opt/h.sh', 'h', '/opt/h.sh --flag', 'get-headers --json', '']) {
    expect(ids(lintProject(NAME, entry(helper)))).toEqual([])
  }
})
it('stays silent for an inline command and a variable path', () => {
  const inline = `echo '{"Authorization": "Bearer '"$(get-token)"'"}'`
  for (const helper of [inline, PLUGIN_ROOT, '$HOME/h.sh', '~/h.sh', 'C:\\tools\\h.cmd']) {
    expect(ids(lintProject(NAME, entry(helper)))).toEqual([])
  }
})
it('stays silent for a headersHelper that is not a string', () => {
  for (const helper of [null, 1, ['./h.sh'], { a: './h.sh' }]) {
    expect(ids(lintProject(NAME, entry(helper)))).toEqual([])
  }
})
it('reads the last headersHelper member', () => {
  const code = '{"mcpServers": {"a": {"headersHelper": "./h.sh", "headersHelper": "/h.sh"}}}'
  expect(ids(lintProject(NAME, code))).toEqual([])
  const rev = '{"mcpServers": {"a": {"headersHelper": "/h.sh", "headersHelper": "./h.sh"}}}'
  expect(ids(lintProject(NAME, rev))).toEqual(['relative'])
})
it('reports each server with a relative helper', () => {
  const both = mapOf({ a: { headersHelper: './a.sh' }, b: { headersHelper: '/b.sh' }, c: {} })
  expect(ids(lintProject(NAME, both))).toEqual(['relative'])
  const two = mapOf({ a: { headersHelper: './a.sh' }, b: { headersHelper: './b.sh' } })
  expect(ids(lintProject(NAME, two))).toEqual(['relative', 'relative'])
})
it('reports in a plugin file, with and without the wrapper', () => {
  expect(ids(lintPluginFile(NAME, entry('./h.sh')))).toEqual(['relative'])
  const bare = JSON.stringify({ a: { headersHelper: './h.sh' } })
  expect(ids(lintPluginFile(NAME, bare))).toEqual(['relative'])
  expect(ids(lintPluginFile(NAME, entry(PLUGIN_ROOT)))).toEqual([])
})
it('reports an inline manifest server on the value', () => {
  const found = lintManifest(NAME, manifest({ a: { headersHelper: './h.sh' } }))
  expect(ids(found)).toEqual(['relative'])
  expect(found[0]).toMatchObject({ line: 1, column: 48, endColumn: 56 })
})
it('reports a server of a declared file on the path in the manifest', () => {
  const found = lintManifest(NAME, manifest('./servers.json'), {
    'p/servers.json': entry('./h.sh'),
  })
  expect(ids(found)).toEqual(['relative'])
  expect(found[0]).toMatchObject({ line: 1, column: 26 })
})
it('leaves the .mcp.json at the plugin root to its own lint', () => {
  expect(ids(lintManifest(NAME, manifest({}), { 'p/.mcp.json': entry('./h.sh') }))).toEqual([])
})
it('does not read a path under .claude/', () => {
  expect(ids(lintProject(NAME, entry('./h.sh'), '.claude/.mcp.json'))).toEqual([])
})
