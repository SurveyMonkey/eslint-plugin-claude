// The rule lints `.claude/settings.json` and checks that a `.gitignore` pattern covers the
// `settings.local.json` beside it. The repositories are real, made with `git init`. The files
// glob is in tests/configs.test.ts.
import { symlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { git, isolateGitConfig, plain, put, repo } from '../git-tree.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const RULE = 'settings-local-gitignored'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
isolateGitConfig()
// Each case starts `git`, and a busy machine needs more than the default 5 s.
vi.setConfig({ testTimeout: 30_000 })

const lint = (root: string, file = PROJECT) => lintJson(RULE, '{}', path.join(root, file))
const ids = (root: string, file = PROJECT) => lint(root, file).map((m) => m.messageId)

describe(RULE, () => {
  it('reports when no pattern covers the file, at the start, and names the path', () => {
    const root = repo({ [PROJECT]: '{}', '.gitignore': 'node_modules\n' })
    const messages = lint(root)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'notIgnored',
      line: 1,
      column: 1,
    })
    expect(messages[0]?.message).toContain(`"${LOCAL}"`)
  })

  it('reports in a repository with no .gitignore, also when the local file is not there', () => {
    expect(ids(repo({ [PROJECT]: '{}' }))).toEqual(['notIgnored'])
    expect(ids(repo({ [PROJECT]: '{}' }, [], { [LOCAL]: '{}' }))).toEqual(['notIgnored'])
  })

  it('stays silent for each form of a pattern that covers the file', () => {
    const root = repo({ [PROJECT]: '{}' })
    for (const pattern of [
      '**/.claude/settings.local.json',
      '.claude/settings.local.json',
      '/.claude/settings.local.json',
      'settings.local.json',
      '*.local.json',
      '.claude/',
      '.claude',
    ]) {
      put(root, { '.gitignore': `${pattern}\n` })
      expect(ids(root), pattern).toEqual([])
    }
  })

  it('reads a .gitignore in the .claude directory', () => {
    const root = repo({ [PROJECT]: '{}', '.claude/.gitignore': 'settings.local.json\n' })
    expect(ids(root)).toEqual([])
  })

  it('checks the path of each project: a pattern for the root does not cover a project below', () => {
    const nested = 'packages/a/.claude/settings.json'
    const anchored = repo({ [nested]: '{}', '.gitignore': '/.claude/settings.local.json\n' })
    expect(ids(anchored, nested)).toEqual(['notIgnored'])
    const wide = repo({ [nested]: '{}', '.gitignore': '**/.claude/settings.local.json\n' })
    expect(ids(wide, nested)).toEqual([])
  })

  it('reports a pattern that a later negation takes back', () => {
    const root = repo({ [PROJECT]: '{}', '.gitignore': `${LOCAL}\n!${LOCAL}\n` })
    expect(ids(root)).toEqual(['notIgnored'])
  })

  it('counts a pattern for a file that git tracks: the answer is the pattern only', () => {
    const covered = repo({ [PROJECT]: '{}', [LOCAL]: '{}', '.gitignore': `${LOCAL}\n` })
    expect(ids(covered)).toEqual([])
    const bare = repo({ [PROJECT]: '{}', [LOCAL]: '{}' })
    expect(ids(bare)).toEqual(['notIgnored'])
  })

  it('does not count a pattern in the global excludes file or in .git/info/exclude', () => {
    // Claude Code writes the pattern to the global excludes file of one machine. A clone on
    // another machine does not have it.
    const global = plain({ '.gitignore': `${LOCAL}\n` })
    put(global, { config: `[core]\n\texcludesFile = ${path.join(global, '.gitignore')}\n` })
    const root = repo({ [PROJECT]: '{}' })
    put(root, { '.git/info/exclude': `${LOCAL}\n` })
    vi.stubEnv('GIT_CONFIG_GLOBAL', path.join(global, 'config'))
    try {
      expect(ids(root)).toEqual(['notIgnored'])
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('takes a path with a space, a dash at the start and a colon at the start as literal', () => {
    for (const dir of ['my dir', '-pkg', ':(top)pkg']) {
      const file = `${dir}/${PROJECT}`
      const bare = repo({ [file]: '{}' })
      expect(ids(bare, file), dir).toEqual(['notIgnored'])
      const covered = repo({ [file]: '{}', [`${dir}/.gitignore`]: 'settings.local.json\n' })
      expect(ids(covered, file), dir).toEqual([])
    }
  })

  it('stays silent in a tree with no .git, where git cannot answer', () => {
    expect(ids(plain({ [PROJECT]: '{}' }))).toEqual([])
  })

  it('stays silent when git cannot run', () => {
    const root = repo({ [PROJECT]: '{}' })
    vi.stubEnv('PATH', '')
    try {
      expect(ids(root)).toEqual([])
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('stays silent when git reads an outer repository', () => {
    const outer = repo({ [`inner/${PROJECT}`]: '{}' })
    put(outer, { 'inner/.git/keep': '' })
    expect(git(path.join(outer, 'inner'), 'rev-parse', '--show-toplevel').trim()).toBe(outer)
    expect(ids(outer, `inner/${PROJECT}`)).toEqual([])
  })

  it.skipIf(process.platform === 'win32')(
    'reads a repository that the linted path reaches through a link',
    () => {
      const root = repo({ 'sub/.claude/settings.json': '{}' })
      const alias = path.join(plain(), 'alias')
      symlinkSync(root, alias)
      expect(lint(alias, 'sub/.claude/settings.json').map((m) => m.messageId)).toEqual([
        'notIgnored',
      ])
    },
  )

  it.skipIf(process.platform === 'win32')(
    'stays silent when .claude is a link: git refuses a path behind a link',
    () => {
      // `settings-local-untracked` reports the link.
      const root = repo({ 'shared/settings.json': '{}' })
      symlinkSync('shared', path.join(root, '.claude'))
      expect(ids(root)).toEqual([])
    },
  )
})
