// Claude Code takes LSP configuration from a plugin: `.lsp.json` at the plugin root, and the
// `lspServers` key of the manifest (plugins components, "LSP servers"; tools reference, "LSP tool
// behavior"). A `.lsp.json` in another place is a no-op. The rule is a heuristic: it reads the
// place of the file, and not its content. The files glob is in tests/configs.test.ts.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { chmodCannotBlock, lintJson, withoutAccess } from '../rule-tester.test-support.ts'

const NAME = 'lsp-json-location'
const code = '{"go": {"command": "gopls", "extensionToLanguage": {".go": "go"}}}'
const PLUGIN = { '.claude-plugin/plugin.json': '{"name": "p"}' }

/** Lint the `.lsp.json` at `at` in a repository with `files`. */
const lintAt = (at: string, files: Record<string, string> = {}, text = code) =>
  lintJson(NAME, text, path.join(repo(files), at))
const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

it('reports a .lsp.json at a repository root with no plugin, on the object', () => {
  const found = lintAt('.lsp.json')
  expect(ids(found)).toEqual(['outside'])
  expect(found[0]).toMatchObject({ line: 1, column: 1 })
  expect(found[0]?.message).toContain('plugin')
})
it('reports a .lsp.json under .claude/', () => {
  expect(ids(lintAt('.claude/.lsp.json'))).toEqual(['outside'])
  expect(ids(lintAt('.claude/lsp/.lsp.json'))).toEqual(['outside'])
})
it('reports a .lsp.json in a folder with a .claude-plugin that holds no manifest', () => {
  expect(ids(lintAt('p/.lsp.json', { 'p/.claude-plugin/marketplace.json': '{}' }))).toEqual([
    'outside',
  ])
})
it('reports a .lsp.json in a package of a repository that has a plugin elsewhere', () => {
  const files = { 'plugins/a/.claude-plugin/plugin.json': '{}' }
  expect(ids(lintAt('packages/b/.lsp.json', files))).toEqual(['outside'])
})
it('reports a .lsp.json in a repository that sits inside a plugin directory', () => {
  const root = repo({})
  mkdirSync(path.join(path.dirname(root), '.claude-plugin'), { recursive: true })
  writeFileSync(path.join(path.dirname(root), '.claude-plugin', 'plugin.json'), '{}')
  expect(ids(lintJson(NAME, code, path.join(root, '.lsp.json')))).toEqual(['outside'])
})
it('reports whatever the content, also an empty file', () => {
  expect(ids(lintAt('.lsp.json', {}, '{}'))).toEqual(['outside'])
  expect(ids(lintAt('.lsp.json', {}, '[]'))).toEqual(['outside'])
})

it('stays silent for a .lsp.json at a plugin root', () => {
  expect(ids(lintAt('.lsp.json', PLUGIN))).toEqual([])
  expect(
    ids(lintAt('plugins/a/.lsp.json', { 'plugins/a/.claude-plugin/plugin.json': '{}' })),
  ).toEqual([])
})
it('stays silent for a .lsp.json below a plugin root, where the manifest can name it', () => {
  expect(ids(lintAt('lsp/.lsp.json', PLUGIN))).toEqual([])
  expect(ids(lintAt('a/b/.lsp.json', PLUGIN))).toEqual([])
  expect(ids(lintAt('.claude-plugin/.lsp.json', PLUGIN))).toEqual([])
  const manifest = '{"name": "p", "lspServers": "./lsp/.lsp.json"}'
  expect(ids(lintAt('lsp/.lsp.json', { '.claude-plugin/plugin.json': manifest }))).toEqual([])
})
it('stays silent for a plugin root with a manifest that does not parse', () => {
  expect(ids(lintAt('.lsp.json', { '.claude-plugin/plugin.json': '{' }))).toEqual([])
})
it('stays silent for a plugin root whose manifest is a dangling link', () => {
  const root = repo({})
  mkdirSync(path.join(root, '.claude-plugin'))
  symlinkSync(path.join(root, 'missing.json'), path.join(root, '.claude-plugin', 'plugin.json'))
  expect(ids(lintJson(NAME, code, path.join(root, '.lsp.json')))).toEqual([])
})
describe('a plugin root that the rule cannot see', () => {
  it('stays silent when .claude-plugin is a link out of the repository', () => {
    const root = repo({})
    const outside = mkdtempSync(path.join(tmpdir(), 'lsp-location-outside-'))
    try {
      mkdirSync(path.join(outside, 'meta'))
      writeFileSync(path.join(outside, 'meta', 'plugin.json'), '{}')
      symlinkSync(path.join(outside, 'meta'), path.join(root, '.claude-plugin'))
      expect(ids(lintJson(NAME, code, path.join(root, '.lsp.json')))).toEqual([])
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })
  it('stays silent when .claude-plugin of an ancestor is a link out of the repository', () => {
    const root = repo({})
    const outside = mkdtempSync(path.join(tmpdir(), 'lsp-location-outside-'))
    try {
      mkdirSync(path.join(root, 'sub'))
      mkdirSync(path.join(outside, 'meta'))
      writeFileSync(path.join(outside, 'meta', 'plugin.json'), '{}')
      symlinkSync(path.join(outside, 'meta'), path.join(root, '.claude-plugin'))
      expect(ids(lintJson(NAME, code, path.join(root, 'sub', '.lsp.json')))).toEqual([])
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })
  describe.skipIf(chmodCannotBlock)('without access', () => {
    it('stays silent when .claude-plugin cannot be read', () => {
      const root = repo(PLUGIN)
      const file = path.join(root, '.lsp.json')
      expect(ids(lintJson(NAME, code, file))).toEqual([])
      withoutAccess(path.join(root, '.claude-plugin'), () => {
        expect(ids(lintJson(NAME, code, file))).toEqual([])
      })
    })
  })
})
