// The rule lints `.claude/settings.json` and checks the `settings.local.json` beside it: git must
// not track it, and `.claude` must not be a link. The repositories are real, made with `git init`.
// The files glob is in tests/configs.test.ts.
import { symlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { git, isolateGitConfig, plain, put, repo } from '../git-tree.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const RULE = 'settings-local-untracked'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const links = process.platform !== 'win32'
isolateGitConfig()
// Each case starts `git`, and a busy machine needs more than the default 5 s.
vi.setConfig({ testTimeout: 30_000 })

const lint = (root: string, file = PROJECT) => lintJson(RULE, '{}', path.join(root, file))
const ids = (root: string, file = PROJECT) => lint(root, file).map((m) => m.messageId)

describe(RULE, () => {
  it('reports a tracked settings.local.json, at the start of the file', () => {
    const root = repo({ [PROJECT]: '{}', [LOCAL]: '{}' })
    const messages = lint(root)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'tracked',
      line: 1,
      column: 1,
    })
    expect(messages[0]?.message).toContain(`"${LOCAL}"`)
  })

  it('reports a tracked file that a .gitignore pattern covers: a pattern does not untrack it', () => {
    const root = repo({ [PROJECT]: '{}', [LOCAL]: '{}', '.gitignore': `${LOCAL}\n` })
    expect(ids(root)).toEqual(['tracked'])
  })

  it('names the path from the repository for a project below the root', () => {
    const root = repo({
      'packages/a/.claude/settings.json': '{}',
      'packages/a/.claude/settings.local.json': '{}',
    })
    const messages = lint(root, 'packages/a/.claude/settings.json')
    expect(messages[0]?.message).toContain('"packages/a/.claude/settings.local.json"')
  })

  it('stays silent when git does not track the local file, or the file is not there', () => {
    const loose = repo({ [PROJECT]: '{}' }, [], { [LOCAL]: '{}' })
    expect(ids(loose)).toEqual([])
    expect(ids(repo({ [PROJECT]: '{}' }))).toEqual([])
  })

  it('does not take the local file of another directory for this one', () => {
    const root = repo({
      [PROJECT]: '{}',
      'packages/a/.claude/settings.local.json': '{}',
      'settings.local.json': '{}',
    })
    expect(ids(root)).toEqual([])
  })

  it('takes a path with a space, a leading dash and a leading colon as literal', () => {
    for (const dir of ['my dir', '-pkg', ':(top)pkg']) {
      const root = repo({ [`${dir}/${PROJECT}`]: '{}', [`${dir}/${LOCAL}`]: '{}' })
      expect(ids(root, `${dir}/${PROJECT}`), dir).toEqual(['tracked'])
    }
  })

  it.skipIf(!links)('reports a .claude that is a link to a directory of the repository', () => {
    const root = repo({ 'shared/settings.json': '{}' })
    symlinkSync('shared', path.join(root, '.claude'))
    const messages = lint(root)
    expect(messages.map((m) => m.messageId)).toEqual(['symlink'])
    expect(messages[0]).toMatchObject({ line: 1, column: 1 })
  })

  it.skipIf(!links)(
    'reports the link and the tracked file both, where the link leads to one',
    () => {
      const root = repo({ 'shared/settings.json': '{}', 'shared/settings.local.json': '{}' })
      symlinkSync('shared', path.join(root, '.claude'))
      expect(ids(root).sort()).toEqual(['symlink', 'tracked'])
    },
  )

  it.skipIf(!links)('reports a .claude that is a link to a place out of the repository', () => {
    const root = repo({ 'a.txt': 'x' })
    const outside = plain({ 'settings.json': '{}', 'settings.local.json': '{}' })
    symlinkSync(outside, path.join(root, '.claude'))
    // The rule reads nothing out of the repository, so it cannot report the tracked file.
    expect(ids(root)).toEqual(['symlink'])
  })

  it.skipIf(!links)('reports the link even when git cannot be read: it needs no git', () => {
    const root = plain({ 'shared/settings.json': '{}' })
    symlinkSync('shared', path.join(root, '.claude'))
    expect(ids(root)).toEqual(['symlink'])
    const tracked = repo({ 'shared/settings.json': '{}' })
    symlinkSync('shared', path.join(tracked, '.claude'))
    vi.stubEnv('PATH', '')
    try {
      expect(ids(tracked)).toEqual(['symlink'])
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('stays silent in a tree with no .git, where git cannot answer', () => {
    const root = plain({ [PROJECT]: '{}', [LOCAL]: '{}' })
    expect(ids(root)).toEqual([])
  })

  it('stays silent when git cannot run', () => {
    const root = repo({ [PROJECT]: '{}', [LOCAL]: '{}' })
    vi.stubEnv('PATH', '')
    try {
      expect(ids(root)).toEqual([])
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('stays silent when git reads an outer repository', () => {
    const outer = repo({ [`inner/${PROJECT}`]: '{}', [`inner/${LOCAL}`]: '{}' })
    put(outer, { 'inner/.git/keep': '' })
    expect(git(path.join(outer, 'inner'), 'rev-parse', '--show-toplevel').trim()).toBe(outer)
    expect(ids(outer, `inner/${PROJECT}`)).toEqual([])
  })

  it('stays silent for a settings file in a directory that is not there', () => {
    // The linted text is a virtual file. No `.claude` is on the disk.
    const root = repo({ 'a.txt': 'x' })
    expect(ids(root)).toEqual([])
  })
})
