// The expected values come from the settings reference. `worktree.symlinkDirectories`
// (https://code.claude.com/docs/en/settings-reference#worktree-symlinkdirectories) and
// `worktree.sparsePaths` (https://code.claude.com/docs/en/settings-reference#worktree-sparsepaths)
// are arrays of strings, "directory paths relative to the repository root". The large codebases page
// says that sparse checkout writes "only those directories plus root-level files"
// (https://code.claude.com/docs/en/large-codebases#check-out-only-the-directories-you-need). The rule
// looks at the disk from the repository root, so each case builds a tree on disk. The file globs are
// in `tests/configs.test.ts`.
import { chmodSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { chmodCannotBlock, lintJson, withoutAccess } from '../rule-tester.test-support.ts'

const name = 'settings-worktree-paths'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const FILES = {
  'packages/api/src/index.ts': '',
  'packages/shared/.gitkeep': '',
  'README.md': '# Readme\n',
  'node_modules/.bin/x': '',
  '.claude/settings.json': '{}',
}
const KEYS = ['symlinkDirectories', 'sparsePaths']

const settings = (key: string, ...paths: unknown[]) =>
  JSON.stringify({ worktree: { [key]: paths } })
const ids = (dir: string, code: string, file = PROJECT) =>
  lintJson(name, code, path.join(dir, file)).map((m) => m.messageId)

describe('settings-worktree-paths: the format', () => {
  it.each(KEYS)('reports a path with a leading slash in %s', (key) => {
    for (const entry of ['/node_modules', '/', '/etc/x', '\\x', 'C:\\x', 'c:/x']) {
      expect(ids(tree(FILES), settings(key, entry)), entry).toEqual(['absolute'])
    }
  })

  it.each(KEYS)('reports a .. segment in %s', (key) => {
    for (const entry of ['..', '../x', 'a/../b', 'a/..', 'a\\..\\b', 'packages/api/../..']) {
      expect(ids(tree(FILES), settings(key, entry)), entry).toEqual(['parent'])
    }
  })

  it('does not call a name with two dots a parent segment', () => {
    for (const entry of ['..x', 'x..', 'a..b']) {
      expect(ids(tree({ [entry]: '' }), settings('sparsePaths', entry)), entry).toEqual(['file'])
    }
  })

  it('reports each entry, on the entry, with the key and the path in the message', () => {
    const dir = tree(FILES)
    const code = '{\n  "worktree": {\n    "sparsePaths": ["packages/api", "/x", "gone"]\n  }\n}'
    const messages = lintJson(name, code, path.join(dir, PROJECT))
    expect(messages.map((m) => [m.messageId, m.line, m.column])).toEqual([
      ['absolute', 3, 37],
      ['missing', 3, 43],
    ])
    expect(messages[0]?.message).toBe(
      '"/x" starts with a slash. The entries of "worktree.sparsePaths" are paths relative to the repository root.',
    )
  })
})

describe('settings-worktree-paths: the disk', () => {
  it.each(KEYS)('reports a path that is not in the repository in %s', (key) => {
    expect(ids(tree(FILES), settings(key, 'packages/gone'))).toEqual(['missing'])
    expect(ids(tree(FILES), settings(key, 'gone/deeper/still'))).toEqual(['missing'])
  })

  it.each(KEYS)('reports a file in %s', (key) => {
    expect(ids(tree(FILES), settings(key, 'README.md'))).toEqual(['file'])
    expect(ids(tree(FILES), settings(key, 'packages/api/src/index.ts'))).toEqual(['file'])
  })

  it.each(KEYS)('is silent for a directory in %s', (key) => {
    for (const entry of [
      'packages/api',
      'packages/api/',
      './packages/api',
      'node_modules',
      '.claude',
      '.',
      '',
    ]) {
      expect(ids(tree(FILES), settings(key, entry)), entry).toEqual([])
    }
  })

  it('reports a path from the repository root, not from the folder of the .claude folder', () => {
    const dir = tree({
      ...FILES,
      'packages/api/.claude/settings.json': '{}',
      'packages/api/src/x': '',
    })
    const file = 'packages/api/.claude/settings.json'
    expect(ids(dir, settings('sparsePaths', 'packages/api'), file)).toEqual([])
    expect(ids(dir, settings('sparsePaths', 'src'), file)).toEqual(['missing'])
  })

  it('reads the local file too', () => {
    expect(ids(tree(FILES), settings('sparsePaths', 'gone'), LOCAL)).toEqual(['missing'])
  })

  it('looks from the repository root and not above it', () => {
    const outer = tree(
      { 'clash/x': '', 'repo/.git/HEAD': '', 'repo/.claude/settings.json': '{}' },
      false,
    )
    const repo = path.join(outer, 'repo')
    expect(ids(repo, settings('sparsePaths', 'clash'))).toEqual(['missing'])
    expect(ids(repo, settings('sparsePaths', '../clash'))).toEqual(['parent'])
  })

  it.skipIf(noLinks)('is silent for a link to a directory in the repository', () => {
    const dir = tree(FILES)
    link(dir, 'lib', 'packages/api')
    link(dir, 'lib-file', 'README.md')
    expect(ids(dir, settings('sparsePaths', 'lib'))).toEqual([])
    expect(ids(dir, settings('sparsePaths', 'lib-file'))).toEqual(['file'])
  })

  it.skipIf(noLinks)('is silent for a link that leads out of the repository', () => {
    const outside = tree({ 'dir/x': '', 'file.txt': '' }, false)
    const dir = tree(FILES)
    link(dir, 'out-dir', path.join(outside, 'dir'))
    link(dir, 'out-file', path.join(outside, 'file.txt'))
    link(dir, 'packages/api/deeper', path.join(outside, 'dir'))
    for (const entry of [
      'out-dir',
      'out-file',
      'out-dir/x',
      'packages/api/deeper',
      'out-dir/gone',
    ]) {
      expect(ids(dir, settings('symlinkDirectories', entry)), entry).toEqual([])
    }
  })

  it.skipIf(noLinks)('is silent for a dangling link, and for a path below one', () => {
    const dir = tree(FILES)
    link(dir, 'dangling', 'nowhere')
    expect(ids(dir, settings('symlinkDirectories', 'dangling'))).toEqual([])
    expect(ids(dir, settings('symlinkDirectories', 'dangling/x'))).toEqual([])
  })

  it.skipIf(chmodCannotBlock)('is silent for a folder that it cannot read', () => {
    const dir = tree(FILES)
    mkdirSync(path.join(dir, 'locked/inner'), { recursive: true })
    withoutAccess(path.join(dir, 'locked'), () => {
      expect(ids(dir, settings('sparsePaths', 'locked/inner'))).toEqual([])
      expect(ids(dir, settings('sparsePaths', 'locked/gone'))).toEqual([])
    })
    chmodSync(path.join(dir, 'locked'), 0o755)
  })

  it('stays inside a repository without a .git folder', () => {
    expect(ids(tree(FILES, false), settings('sparsePaths', 'packages/api', 'gone'))).toEqual([
      'missing',
    ])
  })
})

describe('settings-worktree-paths: what it does not read', () => {
  it('is silent when worktree, the list or an entry has another type', () => {
    for (const code of [
      '{}',
      '{"worktree": "x"}',
      '{"worktree": []}',
      '{"worktree": {}}',
      '{"worktree": {"sparsePaths": "gone"}}',
      '{"worktree": {"sparsePaths": {"a": "gone"}}}',
      '{"worktree": {"sparsePaths": []}}',
      '{"worktree": {"sparsePaths": [1, null, true, ["gone"], {"p": "gone"}]}}',
    ]) {
      expect(ids(tree(FILES), code), code).toEqual([])
    }
  })

  it('does not read the keys that name no path list', () => {
    const code = '{"worktree": {"baseRef": "/x", "bgIsolation": "..", "location": "gone"}}'
    expect(ids(tree(FILES), code)).toEqual([])
  })

  it('reads the last of two keys of one name', () => {
    const twice = (a: string, b: string) =>
      `{"worktree": {"sparsePaths": ["${a}"], "sparsePaths": ["${b}"]}}`
    expect(ids(tree(FILES), twice('gone', 'packages/api'))).toEqual([])
    expect(ids(tree(FILES), twice('packages/api', 'gone'))).toEqual(['missing'])
  })

  it('leaves the list as a whole to settings-worktree-sparse-claude-dir', () => {
    // The list omits .claude. The other rule reports the list. This rule reports no entry.
    expect(ids(tree(FILES), settings('sparsePaths', 'packages/api'))).toEqual([])
  })
})

describe('settings-worktree-paths: a backslash separator', () => {
  it('reads a backslash as a slash', () => {
    expect(ids(tree(FILES), settings('sparsePaths', 'packages\\api'))).toEqual([])
    expect(ids(tree(FILES), settings('sparsePaths', 'packages\\gone'))).toEqual(['missing'])
    expect(ids(tree(FILES), settings('sparsePaths', 'README.md\\'))).toEqual(['file'])
  })
})
