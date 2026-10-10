// The rule lints a `CLAUDE.md` and checks the `CLAUDE.local.md` beside it: git must not track it,
// and a `.gitignore` pattern must cover it. The repositories are real, made with `git init`.
// The files glob is in tests/configs.test.ts.
import { symlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { git, isolateGitConfig, plain, put, repo } from '../git-tree.test-support.ts'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const RULE = 'claude-md-local-untracked'
const LOCAL = 'CLAUDE.local.md'
isolateGitConfig()
// Each case starts `git`, and a busy machine needs more than the default 5 s.
vi.setConfig({ testTimeout: 30_000 })

/** The message ids of the rule for the `CLAUDE.md` at `file` below `root`. */
const lint = (root: string, file = 'CLAUDE.md') =>
  lintMarkdown(RULE, '# Project\n', path.join(root, file)).map((m) => m.messageId)

describe(RULE, () => {
  it('reports a tracked CLAUDE.local.md, at the start of the file', () => {
    const root = repo({ 'CLAUDE.md': '# P\n', [LOCAL]: 'mine\n', '.gitignore': `${LOCAL}\n` })
    const messages = lintMarkdown(RULE, '# P\n', path.join(root, 'CLAUDE.md'))
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'tracked',
      line: 1,
      column: 1,
    })
    expect(messages[0]?.message).toContain('git rm --cached')
  })

  it('reports a tracked file once, even when a pattern covers it', () => {
    const root = repo({ 'CLAUDE.md': '# P\n', [LOCAL]: 'mine\n', '.gitignore': `${LOCAL}\n` })
    expect(lint(root)).toEqual(['tracked'])
  })

  it('reports a CLAUDE.local.md that git does not track and no pattern covers', () => {
    const root = repo({ 'CLAUDE.md': '# P\n', '.gitignore': 'node_modules\n' }, [], {
      [LOCAL]: 'mine\n',
    })
    expect(lint(root)).toEqual(['notIgnored'])
  })

  it('reports a missing pattern when the file is not on the disk: the repository decides', () => {
    const root = repo({ 'CLAUDE.md': '# P\n' })
    expect(lint(root)).toEqual(['notIgnored'])
  })

  it('stays silent when a pattern covers the file and git does not track it', () => {
    const root = repo({ 'CLAUDE.md': '# P\n' }, [], { [LOCAL]: 'mine\n' })
    for (const pattern of [LOCAL, '*.local.md', '/CLAUDE.local.md', '**/CLAUDE.local.md']) {
      put(root, { '.gitignore': `${pattern}\n` })
      expect(lint(root), pattern).toEqual([])
    }
  })

  it('reads a .gitignore in the directory of the file', () => {
    const root = repo({ 'pkg/CLAUDE.md': '# P\n', 'pkg/.gitignore': `${LOCAL}\n` })
    expect(lint(root, 'pkg/CLAUDE.md')).toEqual([])
    const bare = repo({ 'pkg/CLAUDE.md': '# P\n' })
    expect(lint(bare, 'pkg/CLAUDE.md')).toEqual(['notIgnored'])
    expect(lintMarkdown(RULE, '# P\n', path.join(bare, 'pkg/CLAUDE.md'))[0]?.message).toContain(
      '"pkg/CLAUDE.local.md"',
    )
  })

  it('takes a pattern that a later negation takes back as a missing pattern', () => {
    const root = repo({ 'CLAUDE.md': '# P\n', '.gitignore': `*.md\n!${LOCAL}\n` })
    expect(lint(root)).toEqual(['notIgnored'])
  })

  it('checks the CLAUDE.local.md beside each CLAUDE.md, and not the one of another directory', () => {
    const root = repo({
      'CLAUDE.md': '# P\n',
      'pkg/CLAUDE.md': '# Q\n',
      'pkg/CLAUDE.local.md': 'mine\n',
      '.gitignore': `/${LOCAL}\n`,
    })
    // `/CLAUDE.local.md` covers the root file only.
    expect(lint(root)).toEqual([])
    expect(lint(root, 'pkg/CLAUDE.md')).toEqual(['tracked'])
  })

  it('does not read the CLAUDE.local.md of the root for a CLAUDE.md in .claude/', () => {
    // Claude Code loads `CLAUDE.local.md` from the project root, not from `.claude/`.
    const root = repo({ '.claude/CLAUDE.md': '# P\n', '.claude/CLAUDE.local.md': 'x\n' })
    expect(lint(root, '.claude/CLAUDE.md')).toEqual([])
  })

  it('takes a path with a space and a path that starts with a dash as literal', () => {
    const root = repo({ 'my dir/-pkg/CLAUDE.md': '# P\n', 'my dir/-pkg/CLAUDE.local.md': 'x\n' })
    expect(lint(root, 'my dir/-pkg/CLAUDE.md')).toEqual(['tracked'])
    const loose = repo({ '-pkg/CLAUDE.md': '# P\n', '-pkg/.gitignore': `${LOCAL}\n` })
    expect(lint(loose, '-pkg/CLAUDE.md')).toEqual([])
    const colon = repo({ ':(top)pkg/CLAUDE.md': '# P\n' })
    expect(lint(colon, ':(top)pkg/CLAUDE.md')).toEqual(['notIgnored'])
  })

  it('does not count a pattern in the global excludes file or in .git/info/exclude', () => {
    const global = plain({ '.gitignore': `${LOCAL}\n` })
    put(global, { config: `[core]\n\texcludesFile = ${path.join(global, '.gitignore')}\n` })
    const root = repo({ 'CLAUDE.md': '# P\n' })
    put(root, { '.git/info/exclude': `${LOCAL}\n` })
    vi.stubEnv('GIT_CONFIG_GLOBAL', path.join(global, 'config'))
    try {
      expect(lint(root)).toEqual(['notIgnored'])
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('stays silent in a tree with no .git, where git cannot answer', () => {
    const root = plain({ 'CLAUDE.md': '# P\n', [LOCAL]: 'x\n' })
    expect(lint(root)).toEqual([])
  })

  it('stays silent when git cannot run', () => {
    const root = repo({ 'CLAUDE.md': '# P\n', [LOCAL]: 'x\n' })
    vi.stubEnv('PATH', '')
    try {
      expect(lint(root)).toEqual([])
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('stays silent when git reads an outer repository', () => {
    const outer = repo({ 'inner/CLAUDE.md': '# P\n', 'inner/CLAUDE.local.md': 'x\n' })
    put(outer, { 'inner/.git/keep': '' })
    expect(git(path.join(outer, 'inner'), 'rev-parse', '--show-toplevel').trim()).toBe(outer)
    expect(lint(outer, 'inner/CLAUDE.md')).toEqual([])
  })

  it.skipIf(process.platform === 'win32')(
    'stays silent for a directory that is a link to a place out of the repository',
    () => {
      const root = repo({ 'a.txt': 'x' })
      const outside = plain({ 'CLAUDE.md': '# P\n', [LOCAL]: 'x\n' })
      symlinkSync(outside, path.join(root, 'linked'))
      expect(lint(root, 'linked/CLAUDE.md')).toEqual([])
    },
  )

  it.skipIf(process.platform === 'win32')(
    'reads a directory that is a link to a directory of the repository where it leads',
    () => {
      const root = repo({ 'shared/CLAUDE.md': '# P\n', 'shared/CLAUDE.local.md': 'x\n' })
      symlinkSync('shared', path.join(root, 'linked'))
      expect(lint(root, 'linked/CLAUDE.md')).toEqual(['tracked'])
    },
  )
})
