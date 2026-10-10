// `allowedMcpServers: []` allows no server that a user, a plugin or claude.ai adds, unlike an
// unset key (managed MCP page, "Match servers by URL, command, or name"). The managed settings
// page combines the lists of the managed files, so an entry in a sibling file makes the list not
// empty ("Split a file-based policy across teams").
import path from 'node:path'
import { expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const NAME = 'mcp-allowlist-empty'
const managed = 'managed-settings.json'
const dropIn = 'managed-settings.d/20-b.json'
const allow = (...entries: unknown[]) => JSON.stringify({ allowedMcpServers: entries })

const lint = (code: string, file = managed, files: Record<string, string> = {}) =>
  lintJson(NAME, code, path.join(repo(files), file))
const run = (code: string, file = managed, files: Record<string, string> = {}) =>
  lint(code, file, files).map((m) => m.messageId)

it('reports an empty allowlist, on the array', () => {
  const found = lint(allow())
  expect(found.map((m) => m.messageId)).toEqual(['empty'])
  expect(found[0]).toMatchObject({ line: 1, column: 22, endColumn: 24 })
  expect(run(allow(), dropIn)).toEqual(['empty'])
})
it('reports a list with spaces inside', () => {
  expect(run('{"allowedMcpServers": [ ]}')).toEqual(['empty'])
})
it('stays silent when the key is unset or the list has entries', () => {
  expect(run(JSON.stringify({ model: 'x' }))).toEqual([])
  expect(run(allow({ serverName: 'a' }))).toEqual([])
  expect(run(allow(1))).toEqual([])
  expect(run('[]')).toEqual([])
})
it('stays silent for a list that is not an array, and for the denylist', () => {
  expect(run(JSON.stringify({ allowedMcpServers: {} }))).toEqual([])
  expect(run(JSON.stringify({ allowedMcpServers: null }))).toEqual([])
  expect(run(JSON.stringify({ deniedMcpServers: [] }))).toEqual([])
})
it('reads the last list', () => {
  expect(run('{"allowedMcpServers": [], "allowedMcpServers": [{"serverName": "a"}]}')).toEqual([])
  expect(run('{"allowedMcpServers": [{"serverName": "a"}], "allowedMcpServers": []}')).toEqual([
    'empty',
  ])
})
it('skips a hidden drop-in', () => {
  expect(run(allow(), 'managed-settings.d/.10-a.json')).toEqual([])
})
it('stays silent when a sibling file has entries, in any file order', () => {
  expect(run(allow(), dropIn, { [managed]: allow({ serverUrl: 'https://x.test' }) })).toEqual([])
  expect(run(allow(), managed, { [dropIn]: allow({ serverName: 'a' }) })).toEqual([])
})
it('reports when the siblings hold an empty list, no list, or a list that is not an array', () => {
  expect(run(allow(), dropIn, { [managed]: allow() })).toEqual(['empty'])
  expect(run(allow(), dropIn, { [managed]: JSON.stringify({ model: 'x' }) })).toEqual(['empty'])
  expect(run(allow(), dropIn, { [managed]: JSON.stringify({ allowedMcpServers: {} }) })).toEqual([
    'empty',
  ])
  expect(run(allow(), managed, {})).toEqual(['empty'])
})
it('stays silent when a sibling cannot be read, as it can hold entries', () => {
  expect(run(allow(), dropIn, { [managed]: '{ not json' })).toEqual([])
  expect(run(allow(), dropIn, { [managed]: '[1]' })).toEqual([])
})
it('ignores a hidden sibling and a sibling that is not a json file', () => {
  expect(
    run(allow(), dropIn, {
      'managed-settings.d/.10-a.json': allow({ serverName: 'a' }),
      'managed-settings.d/10-b.txt': allow({ serverName: 'a' }),
    }),
  ).toEqual(['empty'])
})
