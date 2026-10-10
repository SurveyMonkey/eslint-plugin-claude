// A server on both lists is blocked, because the denylist takes precedence, so an entry in both
// `allowedMcpServers` and `deniedMcpServers` leaves the allow entry with no effect (settings
// reference). Entries from every file merge into one list. The files are on disk, so the cases
// use `Linter` and a repository with a `.git` directory.
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { chmodCannotBlock, lintJson, withoutAccess } from '../rule-tester.test-support.ts'

const NAME = 'mcp-allow-deny-overlap'
const lists = (allowed?: unknown, denied?: unknown) =>
  JSON.stringify({ allowedMcpServers: allowed, deniedMcpServers: denied })
const named = (serverName: unknown) => ({ serverName })
const url = (serverUrl: unknown) => ({ serverUrl })
const command = (...args: unknown[]) => ({ serverCommand: args })

/** Lint `code` as `file` of a repository with `files`. */
function lint(code: string, files: Record<string, string>, file = '.claude/settings.json') {
  return lintJson(NAME, code, path.join(repo(files), file))
}
const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

it('reports an entry that is in both lists, on the allow entry', () => {
  const found = lint(lists([named('a'), named('db')], [named('db')]), {})
  expect(ids(found)).toEqual(['overlap'])
  expect(found[0]).toMatchObject({ line: 1, column: 42, endColumn: 61 })
  expect(found[0]?.message).toContain('{"serverName":"db"}')
})
it('reports a serverUrl entry and a serverCommand entry', () => {
  const found = lint(
    lists(
      [url('https://a.test/*'), command('npx', '-y', 'srv'), command('npx')],
      [url('https://a.test/*'), command('npx', '-y', 'srv'), command('npx', 'x')],
    ),
    {},
  )
  expect(ids(found)).toEqual(['overlap', 'overlap'])
})
it('reports an entry that another settings file denies', () => {
  expect(
    ids(
      lint(lists([named('db')]), {
        '.claude/settings.local.json': lists(undefined, [named('db')]),
      }),
    ),
  ).toEqual(['overlap'])
  const managed = {
    'managed-settings.json': lists(undefined, [named('db')]),
    'managed-settings.d/10-a.json': lists([named('x')]),
  }
  expect(ids(lint(lists([named('db')]), managed, 'managed-settings.d/20-b.json'))).toEqual([
    'overlap',
  ])
})
it('reports in the file with the allow entry, and not in the file with the deny entry', () => {
  const files = { '.claude/settings.json': lists([named('db')]) }
  expect(ids(lint(lists(undefined, [named('db')]), files, '.claude/settings.local.json'))).toEqual(
    [],
  )
})
it('does not mix the project files with a managed file', () => {
  const managed = { 'managed-settings.json': lists(undefined, [named('db')]) }
  expect(ids(lint(lists([named('db')]), managed))).toEqual([])
})
it('stays silent for entries that differ, or that the policy ignores', () => {
  expect(
    ids(lint(lists([named('a'), url('https://a')], [named('b'), url('https://b')]), {})),
  ).toEqual([])
  // One kind does not match another kind with the same text.
  expect(ids(lint(lists([named('x')], [url('x')]), {}))).toEqual([])
  expect(ids(lint(lists([command('a', 'b')], [command('a b')]), {}))).toEqual([])
  expect(ids(lint(lists([named('a')]), {}))).toEqual([])
  expect(ids(lint(lists(undefined, [named('a')]), {}))).toEqual([])
  expect(ids(lint('{}', {}))).toEqual([])
  expect(ids(lint('[]', {}))).toEqual([])
  expect(ids(lint(lists('x', 'x'), {}))).toEqual([])
})
it('stays silent for an entry that Claude Code strips', () => {
  const bad = [
    named('a b'),
    named(''),
    named(1),
    url(1),
    command('a', 1),
    { serverCommand: 'a' },
    { serverName: 'a', serverUrl: 'b' },
    {},
    1,
    null,
    'a',
    ['a'],
    { serverHost: 'x' },
  ]
  expect(ids(lint(lists(bad, bad), {}))).toEqual([])
})
it('reads the last of two list keys, and the last of two entry keys', () => {
  const twice = `{"allowedMcpServers": [{"serverName": "db"}], "allowedMcpServers": [], "deniedMcpServers": [{"serverName": "db"}]}`
  expect(ids(lint(twice, {}))).toEqual([])
  const entryTwice = `{"allowedMcpServers": [{"serverName": 1, "serverName": "db"}], "deniedMcpServers": [{"serverName": "db"}]}`
  expect(ids(lint(entryTwice, {}))).toEqual(['overlap'])
})
it('keeps the overlap of the file when a sibling cannot be read, and skips a sibling list it cannot read', () => {
  const own = lists([named('db')], [named('db')])
  expect(ids(lint(own, { '.claude/settings.local.json': '{ not json' }))).toEqual(['overlap'])
  expect(ids(lint(lists([named('db')]), { '.claude/settings.local.json': '{ not json' }))).toEqual(
    [],
  )
  const odd = {
    '.claude/settings.local.json': JSON.stringify({ deniedMcpServers: { serverName: 'db' } }),
  }
  expect(ids(lint(lists([named('db')]), odd))).toEqual([])
  const managed = { 'managed-settings.json': '{ not json' }
  expect(ids(lint(own, managed, 'managed-settings.d/10-a.json'))).toEqual(['overlap'])
})
it('keeps the overlap of the file when a sibling is locked', () => {
  const root = repo({ '.claude/settings.local.json': lists(undefined, [named('db')]) })
  if (chmodCannotBlock) {
    return
  }
  const file = path.join(root, '.claude', 'settings.json')
  const locked = path.join(root, '.claude', 'settings.local.json')
  const own = withoutAccess(locked, () => lintJson(NAME, lists([named('db')], [named('db')]), file))
  expect(ids(own)).toEqual(['overlap'])
  const alone = withoutAccess(locked, () => lintJson(NAME, lists([named('db')]), file))
  expect(ids(alone)).toEqual([])
})
it('reads no hidden drop-in', () => {
  const hidden = 'managed-settings.d/.10-a.json'
  expect(ids(lint(lists([named('db')], [named('db')]), {}, hidden))).toEqual([])
})
it('keeps the overlap that readable managed files show when one drop-in cannot be read', () => {
  const files = {
    'managed-settings.json': lists(undefined, [named('db')]),
    'managed-settings.d/05-bad.json': '{ nope',
  }
  expect(ids(lint(lists([named('db')]), files, 'managed-settings.d/10-a.json'))).toEqual([
    'overlap',
  ])
})
it('reads no sibling that is a link out of the repository', () => {
  const root = repo({ '.claude/settings.json': '{}' })
  const outside = mkdtempSync(path.join(tmpdir(), 'mcp-overlap-outside-'))
  try {
    writeFileSync(path.join(outside, 'local.json'), lists(undefined, [named('db')]))
    symlinkSync(path.join(outside, 'local.json'), path.join(root, '.claude', 'settings.local.json'))
    const file = path.join(root, '.claude', 'settings.json')
    expect(ids(lintJson(NAME, lists([named('db')]), file))).toEqual([])
  } finally {
    rmSync(outside, { recursive: true, force: true })
  }
})
