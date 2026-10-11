// The SSE transport is deprecated. The rule reports `type: "sse"`. Another value of `type` is for
// `mcp-server-schema`.
import { expect, it } from 'vitest'
import {
  ids,
  lintManifest,
  lintPluginFile,
  lintProject,
  mapOf,
} from '../mcp-server-rule.test-support.ts'

const NAME = 'mcp-no-sse-transport'
const url = 'https://x.test/sse'
const entry = (type: unknown) => mapOf({ a: { type, url } })
const manifest = (mcpServers: unknown) => JSON.stringify({ name: 'p', mcpServers })

it('reports type sse in a project file, on the value', () => {
  const found = lintProject(NAME, entry('sse'))
  expect(ids(found)).toEqual(['sse'])
  expect(found[0]).toMatchObject({ line: 1, column: 28, endColumn: 33 })
  expect(found[0]?.message).toContain('"a"')
})
it('stays silent for http, streamable-http, ws, stdio and no type', () => {
  for (const type of ['http', 'streamable-http', 'ws', 'stdio']) {
    expect(ids(lintProject(NAME, entry(type)))).toEqual([])
  }
  expect(ids(lintProject(NAME, mapOf({ a: { url } })))).toEqual([])
})
it('leaves another value of type to the server schema rule', () => {
  for (const type of ['SSE', 'sse ', 'sdk', 1, null, ['sse']]) {
    expect(ids(lintProject(NAME, entry(type)))).toEqual([])
  }
})
it('reads the last type member', () => {
  expect(ids(lintProject(NAME, '{"mcpServers": {"a": {"type": "http", "type": "sse"}}}'))).toEqual([
    'sse',
  ])
  expect(ids(lintProject(NAME, '{"mcpServers": {"a": {"type": "sse", "type": "http"}}}'))).toEqual(
    [],
  )
})
it('reports each sse server', () => {
  const both = mapOf({ a: { type: 'sse', url }, b: { type: 'http', url }, c: { type: 'sse', url } })
  expect(ids(lintProject(NAME, both))).toEqual(['sse', 'sse'])
})
it('reports in a plugin file, with and without the wrapper', () => {
  expect(ids(lintPluginFile(NAME, entry('sse')))).toEqual(['sse'])
  expect(ids(lintPluginFile(NAME, JSON.stringify({ a: { type: 'sse', url } })))).toEqual(['sse'])
  expect(ids(lintPluginFile(NAME, entry('http')))).toEqual([])
})
it('reports an inline manifest server on the type value', () => {
  const found = lintManifest(NAME, manifest({ a: { type: 'sse', url } }))
  expect(ids(found)).toEqual(['sse'])
  expect(found[0]).toMatchObject({ line: 1, column: 39, endColumn: 44 })
  expect(ids(lintManifest(NAME, manifest({ a: { type: 'http', url } })))).toEqual([])
})
it('reports a server of a declared file on the path in the manifest', () => {
  const found = lintManifest(NAME, manifest('./servers.json'), { 'p/servers.json': entry('sse') })
  expect(ids(found)).toEqual(['sse'])
  expect(found[0]).toMatchObject({ line: 1, column: 26 })
})
it('leaves the .mcp.json at the plugin root to its own lint', () => {
  expect(ids(lintManifest(NAME, manifest({}), { 'p/.mcp.json': entry('sse') }))).toEqual([])
})
it('does not read a path under .claude/ or a server that is not an object', () => {
  expect(ids(lintProject(NAME, entry('sse'), '.claude/.mcp.json'))).toEqual([])
  expect(ids(lintProject(NAME, mapOf({ a: 'sse' })))).toEqual([])
})
