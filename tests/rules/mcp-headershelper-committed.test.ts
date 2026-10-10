// A `headersHelper` is an arbitrary shell command. In a committed project `.mcp.json` it runs once
// a user trusts the folder. The rule reads the project file only.
import { expect, it } from 'vitest'
import { ids, lintPluginFile, lintProject, mapOf } from '../mcp-server-rule.test-support.ts'

const NAME = 'mcp-headershelper-committed'
const entry = (headersHelper: unknown) =>
  mapOf({ a: { type: 'http', url: 'https://x.test/mcp', headersHelper } })

it.fails('reports a headersHelper in a project file, on the value', () => {
  const found = lintProject(NAME, entry('/opt/h.sh'))
  expect(ids(found)).toEqual(['committed'])
  expect(found[0]).toMatchObject({ line: 1, column: 71, endColumn: 82 })
  expect(found[0]?.message).toContain('"a"')
})
it.fails('reports an inline command and a relative path too', () => {
  for (const helper of ["echo '{}'", './h.sh', 'h']) {
    expect(ids(lintProject(NAME, entry(helper)))).toEqual(['committed'])
  }
})
it.fails('reports each server that has one', () => {
  const code = mapOf({ a: { headersHelper: 'x' }, b: {}, c: { headersHelper: 'y' } })
  expect(ids(lintProject(NAME, code))).toEqual(['committed', 'committed'])
})
it.fails('stays silent for a file with no headersHelper', () => {
  expect(ids(lintProject(NAME, mapOf({ a: { type: 'http', url: 'https://x.test' } })))).toEqual([])
  expect(ids(lintProject(NAME, mapOf({ a: 1 })))).toEqual([])
  expect(ids(lintProject(NAME, '{"mcpServers": []}'))).toEqual([])
})
it.fails('stays silent for a headersHelper that is not a string', () => {
  for (const helper of [null, 1, ['x'], { a: 'x' }]) {
    expect(ids(lintProject(NAME, entry(helper)))).toEqual([])
  }
})
it.fails('reads the last headersHelper member', () => {
  const code = '{"mcpServers": {"a": {"headersHelper": "x", "headersHelper": 1}}}'
  expect(ids(lintProject(NAME, code))).toEqual([])
})
it.fails('stays silent in a plugin file', () => {
  expect(ids(lintPluginFile(NAME, entry('/opt/h.sh')))).toEqual([])
  expect(ids(lintPluginFile(NAME, JSON.stringify({ a: { headersHelper: 'x' } })))).toEqual([])
})
it.fails('does not read a path under .claude/', () => {
  expect(ids(lintProject(NAME, entry('/opt/h.sh'), '.claude/.mcp.json'))).toEqual([])
})
