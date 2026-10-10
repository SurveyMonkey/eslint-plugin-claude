// The docs name the keys of a server entry (MCP page: "Option 4", "Use pre-configured OAuth
// credentials", "Use a fixed OAuth callback port") and the keys of `oauth`. The docs do not say
// that another key is an error, so the rule is a heuristic. The bound of `callbackPort` is the
// range of a TCP port.
import { expect, it } from 'vitest'
import {
  ids,
  lintManifest,
  lintPluginFile,
  lintProject,
  mapOf,
} from '../mcp-server-rule.test-support.ts'

const NAME = 'mcp-unknown-keys'
const at = (entry: unknown) => mapOf({ a: entry })
const http = { type: 'http', url: 'https://x.test/mcp' }

it('reports an unknown entry key, on the key', () => {
  const code = at({ command: 'x', cwd: '/tmp' })
  const found = lintProject(NAME, code)
  expect(ids(found)).toEqual(['entryKey'])
  expect(found[0]).toMatchObject({ line: 1, column: code.indexOf('"cwd"') + 1 })
  expect(found[0]?.message).toContain('"cwd"')
  expect(found[0]?.message).toContain('"a"')
})
it('reports each unknown entry key, and the key of a capital letter', () => {
  expect(ids(lintProject(NAME, at({ command: 'x', cwd: 1, Command: 'y' })))).toEqual([
    'entryKey',
    'entryKey',
  ])
})
it('reports an unknown oauth key, on the key', () => {
  const code = at({ ...http, oauth: { clientId: 'i', clientSecret: 's' } })
  const found = lintProject(NAME, code)
  expect(ids(found)).toEqual(['oauthKey'])
  expect(found[0]).toMatchObject({ line: 1, column: code.indexOf('"clientSecret"') + 1 })
  expect(found[0]?.message).toContain('"clientSecret"')
  expect(found[0]?.message).not.toContain('"s"')
})
it('reports callbackPort that is 70000, 0, negative or not an integer', () => {
  for (const port of [70000, 65536, 0, -1, 80.5]) {
    const code = at({ ...http, oauth: { callbackPort: port } })
    const found = lintProject(NAME, code)
    expect(ids(found), String(port)).toEqual(['port'])
    expect(found[0]).toMatchObject({ line: 1, column: code.indexOf(String(port)) + 1 })
  }
})
it('reports in a plugin file and in the servers of a manifest', () => {
  const entry = { command: 'x', cwd: '/tmp' }
  expect(ids(lintPluginFile(NAME, at(entry)))).toEqual(['entryKey'])
  expect(ids(lintPluginFile(NAME, JSON.stringify({ a: entry })))).toEqual(['entryKey'])
  const manifest = JSON.stringify({ name: 'p', mcpServers: { a: entry } })
  expect(ids(lintManifest(NAME, manifest))).toEqual(['entryKey'])
  const declared = JSON.stringify({ name: 'p', mcpServers: './s.json' })
  expect(ids(lintManifest(NAME, declared, { 'p/s.json': at(entry) }))).toEqual(['entryKey'])
})
it('reports a server of a declared file on the path in the manifest', () => {
  const declared = JSON.stringify({ name: 'p', mcpServers: './s.json' })
  const found = lintManifest(NAME, declared, {
    'p/s.json': at({ command: 'x', cwd: '/tmp', env: {} }),
  })
  expect(found[0]).toMatchObject({ line: 1, column: declared.indexOf('"./s.json"') + 1 })
})
it('reports the last of two members with one name', () => {
  expect(
    ids(lintProject(NAME, '{"mcpServers": {"a": {"command": "x", "cwd": 1, "cwd": 2}}}')),
  ).toEqual(['entryKey'])
  const silent = '{"mcpServers": {"a": {"cwd": 1, "command": "x"}, "a": {"command": "y"}}}'
  expect(ids(lintProject(NAME, silent))).toEqual([])
})

it('reports an unknown oauth key once, when two members have the name', () => {
  const code = '{"mcpServers": {"a": {"type": "http", "oauth": {"x": 1, "x": 2}}}}'
  expect(ids(lintProject(NAME, code))).toEqual(['oauthKey'])
})

it('stays silent for every documented entry key', () => {
  const entry = {
    type: 'http',
    command: 'x',
    args: [],
    env: {},
    url: 'https://x.test',
    headers: {},
    headersHelper: 'x',
    oauth: {},
    timeout: 1000,
    alwaysLoad: true,
  }
  expect(ids(lintProject(NAME, at(entry)))).toEqual([])
})
it('stays silent for every documented oauth key, and a callbackPort from 1 to 65535', () => {
  const oauth = {
    clientId: 'i',
    callbackPort: 8080,
    authServerMetadataUrl: 'https://x.test/.well-known',
    scopes: 'a b',
  }
  expect(ids(lintProject(NAME, at({ ...http, oauth })))).toEqual([])
  for (const port of [1, 65535]) {
    expect(
      ids(lintProject(NAME, at({ ...http, oauth: { callbackPort: port } }))),
      String(port),
    ).toEqual([])
  }
})
it('stays silent for a callbackPort that is not a number', () => {
  // The docs show a number only. The rule cannot tell whether Claude Code reads a string.
  expect(ids(lintProject(NAME, at({ ...http, oauth: { callbackPort: '8080' } })))).toEqual([])
})
it('stays silent for an sdk entry, whose keys the docs do not list', () => {
  expect(ids(lintProject(NAME, at({ type: 'sdk', name: 'x', instance: {} })))).toEqual([])
})
it('stays silent for an entry or an oauth value that is not an object', () => {
  expect(ids(lintProject(NAME, at('x')))).toEqual([])
  expect(ids(lintProject(NAME, at({ ...http, oauth: 'x' })))).toEqual([])
  expect(ids(lintProject(NAME, at({ ...http, oauth: [] })))).toEqual([])
})
it('stays silent for a file that is not a server map, and a path Claude Code skips', () => {
  expect(ids(lintProject(NAME, '[]'))).toEqual([])
  expect(ids(lintProject(NAME, '{"servers": {"a": {"cwd": 1}}}'))).toEqual([])
  expect(ids(lintProject(NAME, at({ cwd: 1 }), '.claude/mcp.json'))).toEqual([])
})
it('reports an oauth key and a port of a declared file on the path in the manifest', () => {
  const declared = JSON.stringify({ name: 'p', mcpServers: './s.json' })
  const files = (oauth: unknown) => ({ 'p/s.json': at({ ...http, oauth }) })
  for (const oauth of [{ clientSecret: 's' }, { callbackPort: 70000 }]) {
    const found = lintManifest(NAME, declared, files(oauth))
    expect(ids(found).length).toBe(1)
    expect(found[0]).toMatchObject({ line: 1, column: declared.indexOf('"./s.json"') + 1 })
  }
})
it('skips an sdk entry with an unknown oauth key and a bad port', () => {
  const entry = { type: 'sdk', oauth: { clientSecret: 's', callbackPort: 70000 } }
  expect(ids(lintProject(NAME, at(entry)))).toEqual([])
})
