// A `serverName` entry matches a label that a user assigns, so it does not control which server
// runs (managed MCP page, "How serverName entries match"). In an allowlist, a name does not
// admit a stdio (remote) server once a `serverCommand` (`serverUrl`) entry exists ("How a
// server is evaluated"). The lists of the managed files combine. `mcp-allowlist-servername-dead`
// reports a name in an allowlist with both kinds. `mcp-policy-entry-schema` reports an invalid
// entry.
import path from 'node:path'
import { expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const NAME = 'mcp-policy-servername-weak'
const managed = 'managed-settings.json'
const dropIn = 'managed-settings.d/20-b.json'
const allow = (...entries: unknown[]) => JSON.stringify({ allowedMcpServers: entries })
const deny = (...entries: unknown[]) => JSON.stringify({ deniedMcpServers: entries })
const url = { serverUrl: 'https://mcp.example.com/*' }
const command = { serverCommand: ['npx', '-y', 'server'] }
const named = (serverName: unknown) => ({ serverName })

/** The messages of the rule for `code` as `file` of a repository with `files`. */
const lint = (code: string, file = managed, files: Record<string, string> = {}) =>
  lintJson(NAME, code, path.join(repo(files), file))
const run = (code: string, file = managed, files: Record<string, string> = {}) =>
  lint(code, file, files).map((m) => m.messageId)

it.fails('reports an allowlist name on the entry', () => {
  const found = lint(allow(named('github')))
  expect(found.map((m) => m.messageId)).toEqual(['allow'])
  expect(found[0]).toMatchObject({ line: 1, column: 23, endColumn: 46 })
  expect(found[0]?.message).toContain('"github"')
})
it.fails('reports a denylist name, also one that the allowlist pattern rejects', () => {
  expect(run(deny(named('dangerous-server')))).toEqual(['deny'])
  const found = lint(deny(named('claude.ai Slack')))
  expect(found.map((m) => m.messageId)).toEqual(['deny'])
  expect(found[0]?.message).toContain('"claude.ai Slack"')
})
it.fails('reports each name of both lists', () => {
  const code = JSON.stringify({
    allowedMcpServers: [named('a'), named('b')],
    deniedMcpServers: [named('c')],
  })
  expect(run(code)).toEqual(['allow', 'allow', 'deny'])
})
it.fails('says that a name does not admit stdio servers once a command entry exists', () => {
  const found = lint(allow(command, named('a')))
  expect(found.map((m) => m.messageId)).toEqual(['allowNoStdio'])
  expect(found[0]?.message).toContain('"a"')
})
it.fails('says that a name does not admit remote servers once a URL entry exists', () => {
  expect(run(allow(url, named('a')))).toEqual(['allowNoRemote'])
})
it.fails('leaves a name in an allowlist with both kinds to mcp-allowlist-servername-dead', () => {
  expect(run(allow(url, command, named('a')))).toEqual([])
  expect(run(allow(named('a')), dropIn, { [managed]: allow(url, command) })).toEqual([])
})
it.fails('leaves a deny name beside both kinds in the allowlist to be reported once', () => {
  const code = JSON.stringify({
    allowedMcpServers: [url, command],
    deniedMcpServers: [named('a')],
  })
  expect(run(code)).toEqual(['deny'])
})
it.fails('leaves an invalid entry to mcp-policy-entry-schema', () => {
  for (const entry of [
    named('a b'),
    named('*'),
    named(''),
    named(1),
    { serverName: 'a', serverUrl: 'https://x.test' },
    {},
    null,
    'a',
    ['a'],
  ]) {
    expect(run(allow(entry))).toEqual([])
  }
  for (const entry of [named(''), named(' a'), named('a '), named(1), { serverName: 'a', x: 1 }]) {
    expect(run(deny(entry))).toEqual([])
  }
})
it.fails('does not count an invalid kind entry', () => {
  expect(run(allow({ serverCommand: [1] }, { serverUrl: 1 }, named('a')))).toEqual(['allow'])
})
it.fails('stays silent for URL and command entries, and for lists that are not arrays', () => {
  expect(run(allow(url, command))).toEqual([])
  expect(run(deny(url, command))).toEqual([])
  expect(run(allow())).toEqual([])
  expect(run(JSON.stringify({ allowedMcpServers: named('a'), deniedMcpServers: 'a' }))).toEqual([])
  expect(run(JSON.stringify({ model: 'x' }))).toEqual([])
  expect(run('[]')).toEqual([])
})
it.fails('reads the last list and the last key of an entry', () => {
  const lists = `{"allowedMcpServers": [{"serverName": "a"}], "allowedMcpServers": []}`
  expect(run(lists)).toEqual([])
  const keys = '{"allowedMcpServers": [{"serverName": 1, "serverName": "a"}]}'
  expect(run(keys)).toEqual(['allow'])
})
it.fails('skips a hidden drop-in', () => {
  expect(run(allow(named('a')), 'managed-settings.d/.10-a.json')).toEqual([])
})
it.fails('counts the kinds of the sibling files', () => {
  expect(run(allow(named('a')), dropIn, { [managed]: allow(command) })).toEqual(['allowNoStdio'])
  expect(run(allow(named('a')), managed, { [dropIn]: allow(url) })).toEqual(['allowNoRemote'])
  expect(run(allow(named('a')), dropIn, { [managed]: allow(named('b')) })).toEqual(['allow'])
})
it.fails('ignores a sibling list that is not an array, and an entry that Claude Code strips', () => {
  const files = { [managed]: JSON.stringify({ allowedMcpServers: { serverCommand: ['x'] } }) }
  expect(run(allow(named('a')), dropIn, files)).toEqual(['allow'])
  expect(run(allow(named('a')), dropIn, { [managed]: allow({ serverCommand: [1] }, 1) })).toEqual([
    'allow',
  ])
})
it.fails('reports with the files that read when a sibling cannot be read', () => {
  expect(run(allow(named('a')), dropIn, { [managed]: '{ not json' })).toEqual(['allow'])
  expect(run(allow(command, named('a')), dropIn, { [managed]: '[1]' })).toEqual(['allowNoStdio'])
})
