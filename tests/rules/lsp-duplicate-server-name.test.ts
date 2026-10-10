// A plugin declares each LSP server name once (plugin manifest reference, "lspServers"). Claude
// Code loads `.lsp.json` at the plugin root first, then each `lspServers` value in order, and a
// later server of one name replaces an earlier one. The files are on disk, so the cases use
// `Linter` and a repository with a `.git` directory.
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { chmodCannotBlock, lintJson, withoutAccess } from '../rule-tester.test-support.ts'

const NAME = 'lsp-duplicate-server-name'
const config = (ext = '.go') => ({ command: 'gopls', extensionToLanguage: { [ext]: 'go' } })
const inline = (...names: string[]) => Object.fromEntries(names.map((n) => [n, config()]))
const lspFile = (...names: string[]) => JSON.stringify(inline(...names))
const manifest = (lspServers: unknown) => JSON.stringify({ name: 'p', lspServers })

/** Lint `code` as the manifest of the plugin `p` in a repository with `files`. */
function lint(code: string, files: Record<string, string> = {}) {
  const root = repo(files)
  return lintJson(NAME, code, path.join(root, 'p', '.claude-plugin', 'plugin.json'))
}
const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

it('reports a name that .lsp.json and the inline map both declare, on the inline name', () => {
  const found = lint(manifest(inline('go', 'rs')), { 'p/.lsp.json': lspFile('go') })
  expect(ids(found)).toEqual(['duplicate'])
  expect(found[0]).toMatchObject({ line: 1, column: 27, endColumn: 31 })
  expect(found[0]?.message).toContain('"go"')
  expect(found[0]?.message).toContain('.lsp.json')
})
it('reports a name in two inline maps of one array', () => {
  const found = lint(manifest([inline('a', 'go'), inline('go', 'b')]))
  expect(ids(found)).toEqual(['duplicate'])
  expect(found[0]?.message).toContain('an inline map')
})
it('reports a name in a declared file and .lsp.json, on the path', () => {
  const found = lint(manifest('./lsp/servers.json'), {
    'p/.lsp.json': lspFile('go'),
    'p/lsp/servers.json': lspFile('go'),
  })
  expect(ids(found)).toEqual(['duplicate'])
  expect(found[0]).toMatchObject({ line: 1, column: 26, endColumn: 46 })
})
it('reports the declaration that comes later, whichever kind it is', () => {
  const found = lint(manifest([inline('go'), './a.json']), { 'p/a.json': lspFile('go') })
  expect(ids(found)).toEqual(['duplicate'])
  expect(found[0]?.message).toContain('an inline map')
})
it('stays silent for distinct names', () => {
  expect(ids(lint(manifest(inline('go', 'rs')), { 'p/.lsp.json': lspFile('c') }))).toEqual([])
})
it('counts a key that one file repeats as one server', () => {
  const twice = '{"go": {"command": "a"}, "go": {"command": "b"}}'
  expect(ids(lint(manifest(inline('x')), { 'p/.lsp.json': twice }))).toEqual([])
  const inlineTwice = '{"lspServers": {"go": {"command": "a"}, "go": {"command": "b"}}}'
  expect(ids(lint(inlineTwice))).toEqual([])
})
it('stays silent when the manifest declares nothing that it can read', () => {
  const files = { 'p/.lsp.json': lspFile('go') }
  expect(ids(lint('{"name": "p"}', files))).toEqual([])
  expect(ids(lint('[]', files))).toEqual([])
  expect(ids(lint(manifest(7), files))).toEqual([])
  expect(ids(lint(manifest([7, null, ['./a.json']]), files))).toEqual([])
  expect(ids(lint(manifest(inline('go')), { 'p/.lsp.json': '[]' }))).toEqual([])
})
it('does not read a path with .., a path that is not .json, or an absolute path', () => {
  const files = {
    'p/.lsp.json': lspFile('go'),
    'p/x.txt': lspFile('go'),
    'p/s.json': lspFile('go'),
  }
  for (const declared of ['../p/.lsp.json', './x.txt', '/abs/s.json', 's.json', '.\\s.json']) {
    expect(ids(lint(manifest(declared), files))).toEqual([])
  }
})
it('stays silent for a file that is not there, or does not parse', () => {
  const files = { 'p/.lsp.json': lspFile('go'), 'p/bad.json': '{ not json' }
  expect(ids(lint(manifest('./missing.json'), files))).toEqual([])
  expect(ids(lint(manifest('./bad.json'), files))).toEqual([])
  expect(ids(lint(manifest(inline('go')), { 'p/.lsp.json': '{ not json' }))).toEqual([])
})
it('stays silent for a link that leads out of the plugin or out of the repository', () => {
  const root = repo({ 'p/.lsp.json': lspFile('go'), 'other/s.json': lspFile('go') })
  const outside = mkdtempSync(path.join(tmpdir(), 'lsp-dup-outside-'))
  try {
    writeFileSync(path.join(outside, 's.json'), lspFile('go'))
    symlinkSync(path.join(root, 'other', 's.json'), path.join(root, 'p', 'in-repo.json'))
    symlinkSync(path.join(root, 'nothing.json'), path.join(root, 'p', 'dangling.json'))
    symlinkSync(path.join(outside, 's.json'), path.join(root, 'p', 'out.json'))
    const at = path.join(root, 'p', '.claude-plugin', 'plugin.json')
    for (const declared of ['./in-repo.json', './dangling.json', './out.json']) {
      expect(ids(lintJson(NAME, manifest(declared), at))).toEqual([])
    }
  } finally {
    rmSync(outside, { recursive: true, force: true })
  }
})
it('keeps the report that the readable files support when one file is locked', () => {
  const root = repo({
    'p/.lsp.json': lspFile('go'),
    'p/locked.json': lspFile('go'),
    'p/ok.json': lspFile('go'),
  })
  const at = path.join(root, 'p', '.claude-plugin', 'plugin.json')
  const code = manifest(['./locked.json', './ok.json'])
  if (chmodCannotBlock) {
    return
  }
  const found = withoutAccess(path.join(root, 'p', 'locked.json'), () => lintJson(NAME, code, at))
  expect(ids(found)).toEqual(['duplicate'])
  expect(found[0]?.message).toContain('.lsp.json')
})
