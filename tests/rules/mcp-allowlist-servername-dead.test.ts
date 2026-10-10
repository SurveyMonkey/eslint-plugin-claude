// With `serverUrl` and `serverCommand` entries in the allowlist, a `serverName` entry admits no
// server (managed MCP page, "How a server is evaluated" and the example). The managed settings
// page combines the lists of the managed files ("Split a file-based policy across teams"). The
// files glob is in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { jsonTester, lintJson, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('mcp-allowlist-servername-dead')

const managed = 'managed-settings.json'
const dropIn = 'etc/claude-code/managed-settings.d/10-a.json'
const allow = (...entries: unknown[]) => JSON.stringify({ allowedMcpServers: entries })
const url = { serverUrl: 'https://mcp.example.com/*' }
const command = { serverCommand: ['npx', '-y', 'server'] }
const named = (serverName: string) => ({ serverName })

jsonTester.run('mcp-allowlist-servername-dead (valid)', rule, {
  valid: [
    { name: 'names only', code: allow(named('a'), named('b')), filename: managed },
    { name: 'a name and a URL', code: allow(url, named('a')), filename: managed },
    { name: 'a name and a command', code: allow(command, named('a')), filename: dropIn },
    { name: 'a URL and a command, no name', code: allow(url, command), filename: managed },
    { name: 'an empty list', code: allow(), filename: managed },
    { name: 'no list', code: JSON.stringify({ model: 'x' }), filename: managed },
    { name: 'array body', code: '[]', filename: managed },
    {
      name: 'a list that is not an array',
      code: JSON.stringify({ allowedMcpServers: {} }),
      filename: managed,
    },
    // Only the allowlist counts. In a denylist a name still blocks a server.
    {
      name: 'a denylist with the three kinds',
      code: JSON.stringify({ deniedMcpServers: [url, command, named('a')] }),
      filename: managed,
    },
    // An entry that Claude Code strips is not an entry. `mcp-policy-entry-schema` reports it.
    {
      name: 'a name that the allowlist pattern rejects',
      code: allow(url, command, named('a b'), named('*'), named('')),
      filename: managed,
    },
    {
      name: 'a URL entry with a value that is not a string',
      code: allow({ serverUrl: 1 }, command, named('a')),
      filename: managed,
    },
    {
      name: 'a command entry with an item that is not a string',
      code: allow(url, { serverCommand: ['npx', 1] }, named('a')),
      filename: managed,
    },
    {
      name: 'a command entry that is not an array',
      code: allow(url, { serverCommand: 'npx' }, named('a')),
      filename: managed,
    },
    {
      name: 'an entry with two keys',
      code: allow(url, { serverCommand: ['npx'], serverName: 'x' }, named('a')),
      filename: managed,
    },
    {
      name: 'an entry with an unknown key, an empty entry, and values that are not entries',
      code: allow(url, command, { serverHost: 'x' }, {}, null, 1, 'a', true, ['a'], named('a b')),
      filename: managed,
    },
    {
      name: 'a name entry with a value that is not a string',
      code: allow(url, command, { serverName: 1 }),
      filename: managed,
    },
    // Claude Code ignores a hidden file in `managed-settings.d`.
    {
      name: 'hidden drop-in',
      code: allow(url, command, named('a')),
      filename: 'managed-settings.d/.10-a.json',
    },
    // Two members of one name. The rule reads the last.
    {
      name: 'duplicate list, the last has names only',
      code: `{"allowedMcpServers": ${allow(url, command, named('a'))}, "allowedMcpServers": [{"serverName": "a"}]}`,
      filename: managed,
    },
    {
      name: 'duplicate key in an entry, the last is invalid',
      code: '{"allowedMcpServers": [{"serverUrl": "https://a.test"}, {"serverCommand": ["x"]}, {"serverName": "a", "serverName": 1}]}',
      filename: managed,
    },
  ],
  invalid: [],
})

jsonTester.run('mcp-allowlist-servername-dead (invalid)', rule, {
  valid: [],
  invalid: [
    {
      name: 'the example of the docs with a name, on the entry',
      code: allow(url, command, named('github')),
      filename: managed,
      errors: [
        { messageId: 'dead', data: { server: 'github' }, line: 1, column: 105, endColumn: 128 },
      ],
    },
    {
      name: 'a drop-in',
      code: allow(command, named('a'), url),
      filename: dropIn,
      errors: [{ messageId: 'dead', data: { server: 'a' } }],
    },
    {
      name: 'one report for each name, before and after the other kinds',
      code: allow(named('a'), url, named('b_-1'), command, named('c')),
      filename: managed,
      errors: [
        { messageId: 'dead', data: { server: 'a' } },
        { messageId: 'dead', data: { server: 'b_-1' } },
        { messageId: 'dead', data: { server: 'c' } },
      ],
    },
    {
      name: 'duplicate list, the last has the three kinds',
      code: `{"allowedMcpServers": [], "allowedMcpServers": ${JSON.stringify([url, command, named('a')])}}`,
      filename: managed,
      errors: [{ messageId: 'dead' }],
    },
    {
      name: 'duplicate key in an entry, the last is a valid name',
      code: '{"allowedMcpServers": [{"serverUrl": "https://a.test"}, {"serverCommand": ["x"]}, {"serverName": 1, "serverName": "a"}]}',
      filename: managed,
      errors: [{ messageId: 'dead', data: { server: 'a' } }],
    },
  ],
})

// The managed settings page combines the lists of `managed-settings.json` and the drop-ins.
describe('mcp-allowlist-servername-dead with sibling managed files', () => {
  const run = (own: string, files: Record<string, string>, file = 'managed-settings.d/20-b.json') =>
    lintJson('mcp-allowlist-servername-dead', own, path.join(repo(files), file)).map(
      (m) => m.messageId,
    )

  it('counts the kinds of the main file and of another drop-in', () => {
    expect(run(allow(named('a')), { [managed]: allow(url, command) })).toEqual(['dead'])
    expect(
      run(allow(named('a')), {
        'managed-settings.d/10-a.json': allow(url),
        'managed-settings.d/30-c.json': allow(command),
      }),
    ).toEqual(['dead'])
  })
  it('counts the kind of a sibling and the kind of the linted file together', () => {
    expect(run(allow(url, named('a')), { [managed]: allow(command) })).toEqual(['dead'])
    expect(run(allow(command, named('a')), { 'managed-settings.d/30-c.json': allow(url) })).toEqual(
      ['dead'],
    )
  })
  it('reports in the main file when a drop-in holds the other kinds', () => {
    expect(
      run(allow(named('a')), { 'managed-settings.d/10-a.json': allow(url, command) }, managed),
    ).toEqual(['dead'])
  })
  it('is silent when the siblings hold one kind', () => {
    expect(run(allow(named('a')), { [managed]: allow(url) })).toEqual([])
    expect(run(allow(url, named('a')), { [managed]: allow(url, named('b')) })).toEqual([])
    expect(run(allow(named('a')), {})).toEqual([])
  })
  it('ignores an entry of a sibling that Claude Code strips', () => {
    expect(
      run(allow(url, named('a')), { [managed]: allow({ serverCommand: [1] }, 1, null, {}) }),
    ).toEqual([])
  })
  it('ignores a sibling list that is not an array, and a sibling without the key', () => {
    expect(
      run(allow(url, named('a')), {
        [managed]: JSON.stringify({ allowedMcpServers: { serverCommand: ['x'] } }),
        'managed-settings.d/10-a.json': JSON.stringify({ model: 'x' }),
      }),
    ).toEqual([])
  })
  it('ignores a hidden sibling and a sibling that is not a json file', () => {
    expect(
      run(allow(url, named('a')), {
        'managed-settings.d/.10-a.json': allow(command),
        'managed-settings.d/10-b.txt': allow(command),
      }),
    ).toEqual([])
  })
  it('is silent when a sibling cannot be read and the linted file lacks a kind', () => {
    expect(run(allow(url, named('a')), { [managed]: '{ not json' })).toEqual([])
    expect(run(allow(named('a')), { [managed]: '[1]' })).toEqual([])
  })
  it('reports when a sibling cannot be read and the linted file has both kinds', () => {
    expect(run(allow(url, command, named('a')), { [managed]: '{ not json' })).toEqual(['dead'])
  })
})
