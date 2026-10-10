// The rule lints `.claude-plugin/plugin.json` and checks that a `.gitignore` pattern covers the
// `results/` directory of the eval suite of that plugin. The repositories are real, made with
// `git init`. The files glob is in tests/configs.test.ts.
import { symlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { git, isolateGitConfig, plain, put, repo } from '../git-tree.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const RULE = 'plugin-evals-results-gitignored'
const MANIFEST = '.claude-plugin/plugin.json'
const CASE = 'evals/first/prompt.md'
isolateGitConfig()
// Each case starts `git`, and a busy machine needs more than the default 5 s.
vi.setConfig({ testTimeout: 30_000 })

/** The text of a manifest, with `experimental.evals` set to `evals` when it is given. */
const manifest = (evals?: unknown) =>
  JSON.stringify(evals === undefined ? { name: 'p' } : { name: 'p', experimental: { evals } })

/** The ids of the messages for the manifest at `file` below `root`. */
const lint = (root: string, code = manifest(), file = MANIFEST) =>
  lintJson(RULE, code, path.join(root, file))
const ids = (root: string, code = manifest(), file = MANIFEST) =>
  lint(root, code, file).map((m) => m.messageId)

describe(RULE, () => {
  it.fails('reports an eval suite when no pattern covers its results directory', () => {
    const root = repo({ [MANIFEST]: manifest(), [CASE]: '# Case\n', '.gitignore': 'dist\n' })
    const messages = lint(root)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'notIgnored',
      line: 1,
      column: 1,
    })
    expect(messages[0]?.message).toContain('"evals/results/"')
  })

  it.fails('reports a suite in a repository with no .gitignore', () => {
    expect(ids(repo({ [MANIFEST]: manifest(), [CASE]: 'x' }))).toEqual(['notIgnored'])
  })

  it.fails('stays silent for each form of a pattern that covers the results directory', () => {
    const root = repo({ [MANIFEST]: manifest(), [CASE]: 'x' })
    for (const pattern of [
      'results/',
      'results',
      'evals/results/',
      'evals/results',
      '/evals/results/',
      '**/results/',
      'evals/results/*',
      'evals/',
      'evals',
    ]) {
      put(root, { '.gitignore': `${pattern}\n` })
      expect(ids(root), pattern).toEqual([])
    }
  })

  it.fails('reports a pattern that does not reach the results directory', () => {
    const root = repo({ [MANIFEST]: manifest(), [CASE]: 'x' })
    for (const pattern of [
      '/results/',
      'other/results/',
      'results.html',
      '*.json',
      'evals/result/',
    ]) {
      put(root, { '.gitignore': `${pattern}\n` })
      expect(ids(root), pattern).toEqual(['notIgnored'])
    }
  })

  it.fails('reports a pattern that a later negation takes back', () => {
    const root = repo({
      [MANIFEST]: manifest(),
      [CASE]: 'x',
      '.gitignore': 'results/\n!results/\n',
    })
    expect(ids(root)).toEqual(['notIgnored'])
  })

  it.fails('reads a .gitignore in the plugin root, and in the eval directory', () => {
    const plugin = 'plugins/p'
    const root = repo({
      [`${plugin}/${MANIFEST}`]: manifest(),
      [`${plugin}/${CASE}`]: 'x',
      [`${plugin}/.gitignore`]: 'evals/results/\n',
    })
    expect(ids(root, manifest(), `${plugin}/${MANIFEST}`)).toEqual([])
    const inner = repo({
      [`${plugin}/${MANIFEST}`]: manifest(),
      [`${plugin}/${CASE}`]: 'x',
      [`${plugin}/evals/.gitignore`]: 'results/\n',
    })
    expect(ids(inner, manifest(), `${plugin}/${MANIFEST}`)).toEqual([])
  })

  it.fails('does not count a pattern of a sibling plugin, and names the path of its own suite', () => {
    const root = repo({
      'plugins/p/.claude-plugin/plugin.json': manifest(),
      'plugins/p/evals/first/prompt.md': 'x',
      'plugins/q/.gitignore': 'evals/results/\n',
    })
    const messages = lint(root, manifest(), 'plugins/p/.claude-plugin/plugin.json')
    expect(messages.map((m) => m.messageId)).toEqual(['notIgnored'])
    expect(messages[0]?.message).toContain('"evals/results/"')
  })

  it.fails('checks the directory that experimental.evals names', () => {
    const files = { [MANIFEST]: manifest('quality/evals'), 'quality/evals/first/prompt.md': 'x' }
    const code = manifest('quality/evals')
    const bare = repo(files)
    const messages = lint(bare, code)
    expect(messages.map((m) => m.messageId)).toEqual(['notIgnored'])
    expect(messages[0]?.message).toContain('"quality/evals/results/"')
    const wrong = repo({ ...files, '.gitignore': '/evals/results/\n' })
    expect(ids(wrong, code)).toEqual(['notIgnored'])
    const right = repo({ ...files, '.gitignore': 'quality/evals/results/\n' })
    expect(ids(right, code)).toEqual([])
  })

  it.fails('uses evals/ when experimental.evals is not a relative path of plain directory names', () => {
    // Claude Code warns and uses `evals/` for an unusable value.
    const root = repo({ [MANIFEST]: manifest(), [CASE]: 'x' })
    for (const value of [
      '/abs/evals',
      '../evals',
      'a/../evals',
      './evals',
      'evals/',
      '',
      'a//b',
      'a\\b',
      'C:evals',
      7,
      null,
      ['evals'],
      { path: 'evals' },
    ]) {
      expect(ids(root, manifest(value)), JSON.stringify(value)).toEqual(['notIgnored'])
    }
    // A manifest without an object for `experimental` uses `evals/` too.
    for (const code of [
      '{"experimental":"qa"}',
      '{"experimental":[]}',
      '[]',
      '{"experimental":{}}',
    ]) {
      expect(ids(root, code), code).toEqual(['notIgnored'])
    }
  })

  it.fails('stays silent for a plugin with no eval directory, or an eval path that is a file', () => {
    expect(ids(repo({ [MANIFEST]: manifest() }))).toEqual([])
    expect(ids(repo({ [MANIFEST]: manifest(), evals: 'x' }))).toEqual([])
    // The directory that the manifest names is not there, and `evals/` is not used.
    expect(ids(repo({ [MANIFEST]: manifest('qa'), [CASE]: 'x' }), manifest('qa'))).toEqual([])
  })

  it.fails('takes a path with a space, a leading dash and a leading colon as literal', () => {
    for (const dir of ['my dir', '-p', ':(top)p']) {
      const root = repo({ [`${dir}/${MANIFEST}`]: manifest(), [`${dir}/${CASE}`]: 'x' })
      expect(ids(root, manifest(), `${dir}/${MANIFEST}`), dir).toEqual(['notIgnored'])
      put(root, { [`${dir}/.gitignore`]: 'evals/results/\n' })
      expect(ids(root, manifest(), `${dir}/${MANIFEST}`), dir).toEqual([])
    }
    const root = repo({ [MANIFEST]: manifest('-evals'), '-evals/first/prompt.md': 'x' })
    expect(ids(root, manifest('-evals'))).toEqual(['notIgnored'])
    const magic = repo({ [MANIFEST]: manifest(':(top)e'), ':(top)e/first/prompt.md': 'x' })
    put(magic, { '.gitignore': 'e/results/\n' })
    expect(ids(magic, manifest(':(top)e'))).toEqual(['notIgnored'])
  })

  it.fails('does not count a pattern in the global excludes file or in .git/info/exclude', () => {
    const global = plain({ '.gitignore': 'results/\n' })
    put(global, { config: `[core]\n\texcludesFile = ${path.join(global, '.gitignore')}\n` })
    const root = repo({ [MANIFEST]: manifest(), [CASE]: 'x' })
    put(root, { '.git/info/exclude': 'results/\n' })
    vi.stubEnv('GIT_CONFIG_GLOBAL', path.join(global, 'config'))
    try {
      expect(ids(root)).toEqual(['notIgnored'])
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it.fails('stays silent in a tree with no .git, where git cannot answer', () => {
    expect(ids(plain({ [MANIFEST]: manifest(), [CASE]: 'x' }))).toEqual([])
  })

  it.fails('stays silent when git cannot run', () => {
    const root = repo({ [MANIFEST]: manifest(), [CASE]: 'x' })
    vi.stubEnv('PATH', '')
    try {
      expect(ids(root)).toEqual([])
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it.fails('stays silent when git reads an outer repository', () => {
    const outer = repo({ [`inner/${MANIFEST}`]: manifest(), [`inner/${CASE}`]: 'x' })
    put(outer, { 'inner/.git/keep': '' })
    expect(git(path.join(outer, 'inner'), 'rev-parse', '--show-toplevel').trim()).toBe(outer)
    expect(ids(outer, manifest(), `inner/${MANIFEST}`)).toEqual([])
  })

  it.fails('stays silent for a manifest that is in no plugin root', () => {
    // The linted text is a virtual file. No `plugin.json` is on the disk.
    const root = repo({ [CASE]: 'x' })
    expect(ids(root)).toEqual([])
  })

  describe('when the eval directory is a link', () => {
    it.fails('stays silent when it leads out of the repository', () => {
      const root = repo({ [MANIFEST]: manifest() })
      const outside = plain({ 'first/prompt.md': 'x' })
      symlinkSync(outside, path.join(root, 'evals'))
      expect(ids(root)).toEqual([])
    })

    it.fails('is read where it leads inside the repository', () => {
      const root = repo({ [MANIFEST]: manifest(), 'shared/first/prompt.md': 'x' })
      symlinkSync('shared', path.join(root, 'evals'))
      expect(ids(root)).toEqual(['notIgnored'])
      put(root, { '.gitignore': 'shared/results/\n' })
      expect(ids(root)).toEqual([])
    })

    it.fails('stays silent when it is a dangling link', () => {
      const root = repo({ [MANIFEST]: manifest() })
      symlinkSync('missing', path.join(root, 'evals'))
      expect(ids(root)).toEqual([])
    })
  })
})
