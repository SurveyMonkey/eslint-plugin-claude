// The expected values come from the large codebases page
// (https://code.claude.com/docs/en/large-codebases#check-out-only-the-directories-you-need):
// "Root-level directories are not [checked out], so include `.claude` in the list if you want the
// repository root's `.claude/settings.json` or `.claude/rules/` available inside the worktree",
// and "the lists merge across scopes, so a local file can add paths to the committed list". The
// rule reads the linted file and the files that Claude Code merges with it, so each case builds a
// tree on disk. The file globs are in `tests/configs.test.ts`.
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'settings-worktree-sparse-claude-dir'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const MANAGED = 'managed-settings.json'
const DROP_IN = 'managed-settings.d/20-b.json'
const EVERY_FILE = [PROJECT, LOCAL, MANAGED, DROP_IN]

const sparse = (...paths: unknown[]) => JSON.stringify({ worktree: { sparsePaths: paths } })
const OMITTED = sparse('packages/api', 'packages/shared')
const LISTED = sparse('.claude', 'packages/api')

/** The ids of the rule for the text `code` at `file` in the tree `dir`. */
const ids = (dir: string, file: string, code = OMITTED) =>
  lintJson(name, code, path.join(dir, file)).map((m) => m.messageId)

describe(`${name}: the linted file`, () => {
  it('reports a list with no .claude, in every settings file, on the list', () => {
    for (const file of EVERY_FILE) {
      expect(ids(tree({}), file), file).toEqual(['omitted'])
    }
    const [message] = lintJson(
      name,
      '{\n  "worktree": {\n    "sparsePaths": ["packages/api"]\n  }\n}',
      path.join(tree({}), PROJECT),
    )
    expect([message?.line, message?.column]).toEqual([3, 20])
  })

  it('is silent when the list has .claude', () => {
    for (const file of EVERY_FILE) {
      expect(ids(tree({}), file, LISTED), file).toEqual([])
    }
  })

  it('reads .claude with a leading ./ or a trailing slash as .claude', () => {
    for (const entry of ['./.claude', '.claude/', './.claude/', '.claude//', 'a/../.claude']) {
      expect(ids(tree({}), PROJECT, sparse(entry, 'packages/api')), entry).toEqual([])
    }
  })

  it('reports an entry that is not the directory .claude', () => {
    for (const entry of [
      '.claude/skills',
      '.claude/rules',
      '.claudex',
      'claude',
      'packages/.claude',
      '/.claude',
      '../.claude',
      '.CLAUDE',
      '',
    ]) {
      expect(ids(tree({}), PROJECT, sparse(entry, 'packages/api')), entry).toEqual(['omitted'])
    }
  })

  it('reports when the only entries that look like .claude are not strings', () => {
    expect(ids(tree({}), PROJECT, sparse(1, null, ['.claude'], { path: '.claude' }))).toEqual([
      'omitted',
    ])
    expect(ids(tree({}), PROJECT, sparse(null, '.claude'))).toEqual([])
  })

  it('is silent when sparsePaths is unset, empty, or not a list', () => {
    for (const code of [
      '{}',
      '{"worktree": {}}',
      '{"worktree": {"sparsePaths": []}}',
      '{"worktree": {"sparsePaths": null}}',
      '{"worktree": {"sparsePaths": ".claude"}}',
      '{"worktree": {"sparsePaths": {"a": 1}}}',
      '{"worktree": null}',
      '{"worktree": "packages/api"}',
      '{"worktree": ["packages/api"]}',
      '{"sparsePaths": ["packages/api"]}',
      '[]',
    ]) {
      expect(ids(tree({}), PROJECT, code), code).toEqual([])
    }
  })

  it('reads the last of two keys of one name', () => {
    const twice = (first: string, second: string) =>
      `{"worktree":{"sparsePaths":${first},"sparsePaths":${second}}}`
    expect(ids(tree({}), PROJECT, twice('[".claude"]', '["a"]'))).toEqual(['omitted'])
    expect(ids(tree({}), PROJECT, twice('["a"]', '[".claude"]'))).toEqual([])
    const worktrees = '{"worktree":{"sparsePaths":[".claude"]},"worktree":{"sparsePaths":["a"]}}'
    expect(ids(tree({}), PROJECT, worktrees)).toEqual(['omitted'])
  })

  it('is silent for a hidden drop-in', () => {
    expect(ids(tree({}), 'managed-settings.d/.20-b.json')).toEqual([])
  })
})

describe(`${name}: the other project file`, () => {
  it('is silent when the other file lists .claude', () => {
    expect(ids(tree({ [LOCAL]: LISTED }), PROJECT)).toEqual([])
    expect(ids(tree({ [PROJECT]: LISTED }), LOCAL)).toEqual([])
  })

  it('reports when the other file omits .claude, has no list, or is not there', () => {
    expect(ids(tree({ [LOCAL]: OMITTED }), PROJECT)).toEqual(['omitted'])
    expect(ids(tree({ [LOCAL]: '{}' }), PROJECT)).toEqual(['omitted'])
    expect(ids(tree({ [LOCAL]: '{"worktree": null}' }), PROJECT)).toEqual(['omitted'])
    expect(ids(tree({ [LOCAL]: '{"worktree": {"sparsePaths": ".claude"}}' }), PROJECT)).toEqual([
      'omitted',
    ])
    expect(ids(tree({ [LOCAL]: sparse(1, null) }), PROJECT)).toEqual(['omitted'])
    expect(ids(tree({}), PROJECT)).toEqual(['omitted'])
    // Both files omit it: each one gets a report.
    const both = { [PROJECT]: OMITTED, [LOCAL]: OMITTED }
    expect(ids(tree(both), PROJECT)).toEqual(['omitted'])
    expect(ids(tree(both), LOCAL)).toEqual(['omitted'])
  })

  it('reads the file in the same .claude folder, not another folder', () => {
    const dir = tree({ 'pkg/.claude/settings.local.json': LISTED })
    expect(ids(dir, PROJECT)).toEqual(['omitted'])
    expect(ids(dir, 'pkg/.claude/settings.json')).toEqual([])
  })

  it('makes no report when the other file cannot be seen', () => {
    // A file that does not parse to an object can hold the list.
    for (const text of ['[]', '"x"', 'null', '{"worktree": ', '']) {
      expect(ids(tree({ [LOCAL]: text }), PROJECT), text).toEqual([])
    }
    // A read that fails: a directory in place of the file.
    const dir = tree({})
    mkdirSync(path.join(dir, LOCAL), { recursive: true })
    expect(ids(dir, PROJECT)).toEqual([])
  })

  it.skipIf(noLinks)(
    'makes no report for a link that has no target, or leads out of the repository',
    () => {
      const dangling = tree({})
      link(dangling, LOCAL, 'missing.json')
      expect(ids(dangling, PROJECT)).toEqual([])
      // The target omits .claude. A read that left the bound would find no .claude and report.
      const outside = tree({ 'out.json': OMITTED }, false)
      const dir = tree({})
      link(dir, LOCAL, path.join(outside, 'out.json'))
      expect(ids(dir, PROJECT)).toEqual([])
    },
  )
})

describe(`${name}: a managed file`, () => {
  it('is silent when another file of the managed source lists .claude', () => {
    expect(ids(tree({ [DROP_IN]: LISTED }), MANAGED)).toEqual([])
    expect(ids(tree({ [MANAGED]: LISTED }), DROP_IN)).toEqual([])
    expect(ids(tree({ 'managed-settings.d/10-a.json': LISTED }), DROP_IN)).toEqual([])
  })

  it('is silent when any one of several files lists .claude', () => {
    const a = 'managed-settings.d/10-a.json'
    expect(ids(tree({ [MANAGED]: OMITTED, [a]: OMITTED, [DROP_IN]: LISTED }), MANAGED)).toEqual([])
    expect(ids(tree({ [MANAGED]: LISTED, [a]: OMITTED }), DROP_IN)).toEqual([])
    expect(ids(tree({ [MANAGED]: OMITTED, [a]: LISTED }), DROP_IN)).toEqual([])
  })

  it('reports when no file of the source lists .claude', () => {
    const a = 'managed-settings.d/10-a.json'
    expect(ids(tree({ [a]: OMITTED }), DROP_IN)).toEqual(['omitted'])
    expect(ids(tree({ [MANAGED]: '{}', [a]: OMITTED }), DROP_IN)).toEqual(['omitted'])
  })

  it('does not read a hidden drop-in, a project file, or a file that is not .json', () => {
    const sources = {
      'managed-settings.d/.10-a.json': LISTED,
      'managed-settings.d/10-b.txt': LISTED,
      [PROJECT]: LISTED,
      [LOCAL]: LISTED,
    }
    expect(ids(tree(sources), MANAGED)).toEqual(['omitted'])
    // A managed file does not make a project file silent.
    expect(ids(tree({ [MANAGED]: LISTED }), PROJECT)).toEqual(['omitted'])
  })

  it('makes no report when a file of the source cannot be seen', () => {
    for (const text of ['[]', 'null', '{"worktree": ', '']) {
      expect(ids(tree({ [DROP_IN]: text }), MANAGED), text).toEqual([])
    }
    const dir = tree({})
    mkdirSync(path.join(dir, 'managed-settings.d', '10-a.json'), { recursive: true })
    expect(ids(dir, MANAGED)).toEqual([])
  })

  it.skipIf(noLinks)('makes no report for a managed-settings.d link out of the repository', () => {
    // The directory holds a file that omits .claude. A read that left the bound would report.
    const outside = tree({ 'managed-settings.d/10-a.json': OMITTED }, false)
    const dir = tree({})
    link(dir, 'managed-settings.d', path.join(outside, 'managed-settings.d'))
    expect(ids(dir, MANAGED)).toEqual([])
    const dangling = tree({})
    link(dangling, 'managed-settings.d', 'missing')
    expect(ids(dangling, MANAGED)).toEqual([])
  })
})
