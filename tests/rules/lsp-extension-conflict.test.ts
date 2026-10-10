// Two LSP servers that claim one file extension: Claude Code uses the first one registered for
// those files, and not the other, "whether the servers come from one plugin or two" (plugin
// components, "LSP servers"). The rule lints `marketplace.json` and reads the plugin of each entry
// that has a relative source. The files are on disk, so the cases use `Linter` and a repository
// with a `.git` directory.
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { chmodCannotBlock, lintJson, withoutAccess } from '../rule-tester.test-support.ts'

const NAME = 'lsp-extension-conflict'
const server = (...exts: string[]) => ({
  command: 'ls',
  extensionToLanguage: Object.fromEntries(exts.map((e) => [e, 'x'])),
})
const lsp = (servers: Record<string, string[]>) =>
  JSON.stringify(Object.fromEntries(Object.entries(servers).map(([n, e]) => [n, server(...e)])))
const entry = (name: string, source = `./plugins/${name}`) => ({ name, source })
const market = (...entries: unknown[]) => JSON.stringify({ name: 'm', plugins: entries })
const manifestOf = (name: string, lspServers: unknown) => JSON.stringify({ name, lspServers })

/** Lint `code` as the marketplace file of a repository with `files`. */
function lint(code: string, files: Record<string, string> = {}) {
  const root = repo(files)
  return lintJson(NAME, code, path.join(root, '.claude-plugin', 'marketplace.json'))
}
const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

it('reports an extension that two plugins claim, on the source of the later entry', () => {
  const found = lint(market(entry('a'), entry('b')), {
    'plugins/a/.lsp.json': lsp({ ts: ['.ts'] }),
    'plugins/b/.lsp.json': lsp({ tsx: ['.ts', '.tsx'] }),
  })
  expect(ids(found)).toEqual(['conflict'])
  expect(found[0]).toMatchObject({ line: 1, column: 81, endColumn: 94 })
  expect(found[0]?.message).toContain('".ts"')
  expect(found[0]?.message).toContain('"ts"')
  expect(found[0]?.message).toContain('"tsx"')
  expect(found[0]?.message).toContain('"a"')
  expect(found[0]?.message).toContain('"b"')
})
it('reads the inline lspServers of a manifest and a declared file', () => {
  const found = lint(market(entry('a'), entry('b'), entry('c')), {
    'plugins/a/.lsp.json': lsp({ ts: ['.ts'] }),
    'plugins/b/.claude-plugin/plugin.json': manifestOf('b', { go: server('.go') }),
    'plugins/c/.claude-plugin/plugin.json': manifestOf('c', './lsp.json'),
    'plugins/c/lsp.json': lsp({ again: ['.go'] }),
  })
  expect(ids(found)).toEqual(['conflict'])
  expect(found[0]?.message).toContain('"c"')
})
it('reports a conflict between two servers of one plugin', () => {
  const found = lint(market(entry('a')), {
    'plugins/a/.lsp.json': lsp({ ts: ['.ts'] }),
    'plugins/a/.claude-plugin/plugin.json': manifestOf('a', { other: server('.ts') }),
  })
  expect(ids(found)).toEqual(['conflict'])
  expect(found[0]?.message).toContain('"ts"')
  expect(found[0]?.message).toContain('"other"')
})
it('reports each later entry once for an extension, and each extension', () => {
  const files = {
    'plugins/a/.lsp.json': lsp({ s: ['.ts', '.go'] }),
    'plugins/b/.lsp.json': lsp({ s: ['.ts', '.go'] }),
    'plugins/c/.lsp.json': lsp({ s: ['.ts'] }),
  }
  const found = lint(market(entry('a'), entry('b'), entry('c')), files)
  expect(ids(found)).toEqual(['conflict', 'conflict', 'conflict'])
})
it('reads a plugin that has no manifest', () => {
  const found = lint(market(entry('a'), entry('b')), {
    'plugins/a/.lsp.json': lsp({ s: ['.ts'] }),
    'plugins/b/.lsp.json': lsp({ s: ['.ts'] }),
    'plugins/b/.claude-plugin/other.json': '{}',
  })
  expect(ids(found)).toEqual(['conflict'])
})
it('stays silent for distinct extensions', () => {
  const found = lint(market(entry('a'), entry('b')), {
    'plugins/a/.lsp.json': lsp({ s: ['.ts'] }),
    'plugins/b/.lsp.json': lsp({ s: ['.tsx'] }),
  })
  expect(ids(found)).toEqual([])
})
it('does not count a server that a later one of the same name replaces', () => {
  const found = lint(market(entry('a'), entry('b')), {
    'plugins/a/.lsp.json': lsp({ go: ['.go'] }),
    'plugins/a/.claude-plugin/plugin.json': manifestOf('a', { go: server('.golang') }),
    'plugins/b/.lsp.json': lsp({ go: ['.go'] }),
  })
  expect(ids(found)).toEqual([])
})
it('reads a plugin once when two entries share a source', () => {
  const files = { 'plugins/a/.lsp.json': lsp({ s: ['.ts'] }) }
  expect(ids(lint(market(entry('a'), entry('again', './plugins/a')), files))).toEqual([])
})
it('does not read an entry that has no relative source, or a marketplace it cannot read', () => {
  const files = {
    'plugins/a/.lsp.json': lsp({ s: ['.ts'] }),
    'plugins/b/.lsp.json': lsp({ s: ['.ts'] }),
  }
  const remote = { name: 'r', source: { source: 'github', repo: 'o/r' } }
  expect(
    ids(lint(market(entry('a'), remote, { name: 'x' }, 7, entry('b', './missing')), files)),
  ).toEqual([])
  expect(ids(lint('[]', files))).toEqual([])
  expect(ids(lint('{"name": "m"}', files))).toEqual([])
  expect(ids(lint('{"plugins": 7}', files))).toEqual([])
})
it('stays silent for a plugin it cannot see', () => {
  const root = repo({
    'plugins/a/.lsp.json': lsp({ s: ['.ts'] }),
    'plugins/b/.lsp.json': '{ not json',
    'plugins/c/.lsp.json': lsp({ s: ['.ts'] }),
    'plugins/d/readme.txt': '',
  })
  const at = path.join(root, '.claude-plugin', 'marketplace.json')
  expect(ids(lintJson(NAME, market(entry('a'), entry('b')), at))).toEqual([])
  const outside = mkdtempSync(path.join(tmpdir(), 'lsp-conflict-outside-'))
  try {
    writeFileSync(path.join(outside, '.lsp.json'), lsp({ s: ['.ts'] }))
    symlinkSync(outside, path.join(root, 'plugins', 'out'))
    symlinkSync(path.join(root, 'nothing'), path.join(root, 'plugins', 'dangling'))
    symlinkSync(path.join(outside, '.lsp.json'), path.join(root, 'plugins', 'd', '.lsp.json'))
    for (const name of ['out', 'dangling', 'd']) {
      expect(ids(lintJson(NAME, market(entry('a'), entry(name)), at))).toEqual([])
    }
  } finally {
    rmSync(outside, { recursive: true, force: true })
  }
})
it('keeps the report that the readable files support when one file is locked', () => {
  const root = repo({
    'plugins/a/.lsp.json': lsp({ s: ['.ts'] }),
    'plugins/b/.lsp.json': lsp({ s: ['.ts'] }),
    'plugins/c/.lsp.json': lsp({ s: ['.ts'] }),
  })
  const at = path.join(root, '.claude-plugin', 'marketplace.json')
  if (chmodCannotBlock) {
    return
  }
  const code = market(entry('a'), entry('b'), entry('c'))
  const found = withoutAccess(path.join(root, 'plugins', 'b', '.lsp.json'), () =>
    lintJson(NAME, code, at),
  )
  expect(ids(found)).toEqual(['conflict'])
  expect(found[0]?.message).toContain('"c"')
})

it('names a plugin that has no name by its directory, and reports an extension once for an entry', () => {
  const found = lint(market(entry('a'), { source: './plugins/b' }), {
    'plugins/a/.lsp.json': lsp({ s: ['.ts'] }),
    'plugins/b/.lsp.json': lsp({ s: ['.ts'], t: ['.ts'] }),
  })
  expect(ids(found)).toEqual(['conflict'])
  expect(found[0]?.message).toContain('plugin "b"')
  expect(found[0]?.message).toContain('plugin "a"')
})

it('claims nothing for a server that has no extension map, or a map that is not an object', () => {
  const found = lint(market(entry('a'), entry('b')), {
    'plugins/a/.lsp.json': JSON.stringify({
      bare: { command: 'x' },
      odd: 7,
      list: { extensionToLanguage: ['.ts'] },
    }),
    'plugins/b/.lsp.json': lsp({ s: ['.ts'] }),
  })
  expect(ids(found)).toEqual([])
})
