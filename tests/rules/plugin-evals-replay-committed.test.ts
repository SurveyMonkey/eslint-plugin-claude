// The rule lints `.claude-plugin/plugin.json` and checks the `mocks/.replay/` directory of the eval
// suite of that plugin: no `.gitignore` pattern covers it, and git tracks its files. The
// repositories are real, made with `git init`. The files glob is in tests/configs.test.ts.
import { mkdirSync, symlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { git, isolateGitConfig, plain, put, repo } from '../git-tree.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const RULE = 'plugin-evals-replay-committed'
const MANIFEST = '.claude-plugin/plugin.json'
const CASE = 'evals/first/prompt.md'
const REPLAY = 'evals/mocks/.replay/github/answer.md'
isolateGitConfig()
// Each case starts `git`, and a busy machine needs more than the default 5 s.
vi.setConfig({ testTimeout: 30_000 })

/** The text of a manifest, with `experimental.evals` set when it is given. */
const manifest = (evals?: string) =>
  JSON.stringify(evals === undefined ? { name: 'p' } : { name: 'p', experimental: { evals } })

const lint = (root: string, code = manifest(), file = MANIFEST) =>
  lintJson(RULE, code, path.join(root, file))
const ids = (root: string, code = manifest(), file = MANIFEST) =>
  lint(root, code, file).map((m) => m.messageId)

describe(RULE, () => {
  it.fails('reports a .gitignore pattern that covers mocks/.replay/, at the start', () => {
    const root = repo({ [MANIFEST]: manifest(), [CASE]: 'x', '.gitignore': '.replay/\n' })
    const messages = lint(root)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'ignored',
      line: 1,
      column: 1,
    })
    expect(messages[0]?.message).toContain('"evals/mocks/.replay/"')
  })

  it.fails('reports each form of a pattern that covers the directory, with or without the directory', () => {
    const root = repo({ [MANIFEST]: manifest(), [CASE]: 'x' })
    for (const pattern of [
      '.replay/',
      '.replay',
      'mocks/.replay/',
      'evals/mocks/.replay/',
      '/evals/mocks/.replay',
      '**/.replay/',
      'mocks/',
      'evals/mocks',
    ]) {
      put(root, { '.gitignore': `${pattern}\n` })
      expect(ids(root), pattern).toEqual(['ignored'])
    }
  })

  it.fails('stays silent for a pattern that does not reach the directory', () => {
    const root = repo({ [MANIFEST]: manifest(), [CASE]: 'x' })
    for (const pattern of [
      'results/',
      '/.replay/',
      'replay/',
      '*.md',
      'mocks/other/',
      '# .replay/',
    ]) {
      put(root, { '.gitignore': `${pattern}\n` })
      expect(ids(root), pattern).toEqual([])
    }
  })

  it.fails('stays silent for a pattern that a later negation takes back', () => {
    const root = repo({
      [MANIFEST]: manifest(),
      [CASE]: 'x',
      '.gitignore': '.replay/\n!evals/mocks/.replay/\n',
    })
    expect(ids(root)).toEqual([])
  })

  it.fails('reports files in mocks/.replay/ that git does not track', () => {
    const root = repo({ [MANIFEST]: manifest(), [CASE]: 'x' }, [], { [REPLAY]: 'answer\n' })
    const messages = lint(root)
    expect(messages.map((m) => m.messageId)).toEqual(['untracked'])
    expect(messages[0]).toMatchObject({ line: 1, column: 1 })
    expect(messages[0]?.message).toContain('"evals/mocks/.replay/"')
  })

  it.fails('stays silent when git tracks a file in mocks/.replay/, at any depth', () => {
    const root = repo({ [MANIFEST]: manifest(), [REPLAY]: 'answer\n' })
    expect(ids(root)).toEqual([])
    const deep = repo({
      [MANIFEST]: manifest(),
      'evals/mocks/.replay/a/b/c/answer.md': 'x',
    })
    expect(ids(deep)).toEqual([])
  })

  it.fails('stays silent when git tracks one file and another file is new', () => {
    const root = repo({ [MANIFEST]: manifest(), [REPLAY]: 'x' }, [], {
      'evals/mocks/.replay/github/new.md': 'y',
    })
    expect(ids(root)).toEqual([])
  })

  it.fails('does not take a tracked file of another directory for a recording', () => {
    const root = repo({ [MANIFEST]: manifest(), 'evals/mocks/github/x.md': 'x' }, [], {
      [REPLAY]: 'answer\n',
    })
    expect(ids(root)).toEqual(['untracked'])
    const sibling = repo({ [MANIFEST]: manifest(), 'evals/mocks/.replay-old/x.md': 'x' }, [], {
      [REPLAY]: 'answer\n',
    })
    expect(ids(sibling)).toEqual(['untracked'])
  })

  it.fails('stays silent for a missing mocks/.replay/, an empty one, and a file of that name', () => {
    expect(ids(repo({ [MANIFEST]: manifest(), [CASE]: 'x' }))).toEqual([])
    const empty = repo({ [MANIFEST]: manifest(), [CASE]: 'x' })
    mkdirSync(path.join(empty, 'evals/mocks/.replay'), { recursive: true })
    expect(ids(empty)).toEqual([])
    expect(ids(repo({ [MANIFEST]: manifest(), 'evals/mocks/.replay': 'x' }))).toEqual([])
  })

  it.fails('reports the pattern once for files that are there, tracked or not', () => {
    const tracked = repo({ [MANIFEST]: manifest(), [REPLAY]: 'x', '.gitignore': '.replay/\n' })
    expect(ids(tracked)).toEqual(['ignored'])
    const loose = repo({ [MANIFEST]: manifest(), '.gitignore': '.replay/\n' }, [], {
      [REPLAY]: 'x',
    })
    expect(ids(loose)).toEqual(['ignored'])
  })

  it.fails('checks the directory that experimental.evals names', () => {
    const code = manifest('quality/evals')
    const files = { [MANIFEST]: code, 'quality/evals/first/prompt.md': 'x' }
    const loose = { 'quality/evals/mocks/.replay/github/answer.md': 'x' }
    const messages = lint(repo(files, [], loose), code)
    expect(messages.map((m) => m.messageId)).toEqual(['untracked'])
    expect(messages[0]?.message).toContain('"quality/evals/mocks/.replay/"')
    const ignored = repo({ ...files, '.gitignore': 'quality/evals/mocks/.replay/\n' })
    expect(ids(ignored, code)).toEqual(['ignored'])
    const other = repo({ ...files, '.gitignore': 'evals/mocks/.replay/\n' })
    expect(ids(other, code)).toEqual([])
  })

  it.fails('stays silent for a plugin with no eval directory', () => {
    expect(ids(repo({ [MANIFEST]: manifest(), '.gitignore': '.replay/\n' }))).toEqual([])
  })

  it.fails('takes a path with a space, a leading dash and a leading colon as literal', () => {
    for (const dir of ['my dir', '-p', ':(top)p']) {
      const root = repo({ [`${dir}/${MANIFEST}`]: manifest(), [`${dir}/${CASE}`]: 'x' }, [], {
        [`${dir}/${REPLAY}`]: 'x',
      })
      expect(ids(root, manifest(), `${dir}/${MANIFEST}`), dir).toEqual(['untracked'])
      put(root, { [`${dir}/.gitignore`]: '.replay/\n' })
      expect(ids(root, manifest(), `${dir}/${MANIFEST}`), dir).toEqual(['ignored'])
    }
  })

  it.fails('does not count a pattern in the global excludes file or in .git/info/exclude', () => {
    const global = plain({ '.gitignore': '.replay/\n' })
    put(global, { config: `[core]\n\texcludesFile = ${path.join(global, '.gitignore')}\n` })
    const root = repo({ [MANIFEST]: manifest(), [CASE]: 'x' })
    put(root, { '.git/info/exclude': '.replay/\n' })
    vi.stubEnv('GIT_CONFIG_GLOBAL', path.join(global, 'config'))
    try {
      expect(ids(root)).toEqual([])
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it.fails('stays silent in a tree with no .git, where git cannot answer', () => {
    const root = plain({ [MANIFEST]: manifest(), [REPLAY]: 'x', '.gitignore': '.replay/\n' })
    expect(ids(root)).toEqual([])
  })

  it.fails('stays silent when git cannot run', () => {
    const root = repo({ [MANIFEST]: manifest(), '.gitignore': '.replay/\n', [CASE]: 'x' })
    vi.stubEnv('PATH', '')
    try {
      expect(ids(root)).toEqual([])
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it.fails('stays silent when git reads an outer repository', () => {
    const outer = repo({ [`inner/${MANIFEST}`]: manifest(), [`inner/${CASE}`]: 'x' })
    put(outer, { 'inner/.git/keep': '', 'inner/.gitignore': '.replay/\n' })
    expect(git(path.join(outer, 'inner'), 'rev-parse', '--show-toplevel').trim()).toBe(outer)
    expect(ids(outer, manifest(), `inner/${MANIFEST}`)).toEqual([])
  })

  it.fails('stays silent for a manifest that is in no plugin root', () => {
    const root = repo({ [CASE]: 'x', '.gitignore': '.replay/\n' })
    expect(ids(root)).toEqual([])
  })

  describe('when mocks/.replay is a link', () => {
    it.fails('stays silent when it leads out of the repository', () => {
      const root = repo({ [MANIFEST]: manifest(), [CASE]: 'x' })
      const outside = plain({ 'github/answer.md': 'x' })
      mkdirSync(path.join(root, 'evals/mocks'), { recursive: true })
      symlinkSync(outside, path.join(root, 'evals/mocks/.replay'))
      expect(ids(root)).toEqual([])
    })

    it.fails('is read where it leads inside the repository', () => {
      const loose = repo({ [MANIFEST]: manifest(), [CASE]: 'x' }, [], {
        'shared/github/answer.md': 'x',
      })
      mkdirSync(path.join(loose, 'evals/mocks'), { recursive: true })
      symlinkSync('../../shared', path.join(loose, 'evals/mocks/.replay'))
      expect(ids(loose)).toEqual(['untracked'])
      const tracked = repo({ [MANIFEST]: manifest(), [CASE]: 'x', 'shared/github/answer.md': 'x' })
      mkdirSync(path.join(tracked, 'evals/mocks'), { recursive: true })
      symlinkSync('../../shared', path.join(tracked, 'evals/mocks/.replay'))
      expect(ids(tracked)).toEqual([])
    })

    it.fails('stays silent when it is a dangling link', () => {
      const root = repo({ [MANIFEST]: manifest(), [CASE]: 'x' })
      mkdirSync(path.join(root, 'evals/mocks'), { recursive: true })
      symlinkSync('missing', path.join(root, 'evals/mocks/.replay'))
      expect(ids(root)).toEqual([])
    })
  })
})
