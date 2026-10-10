// The rule lints `.claude-plugin/plugin.json` and checks the git index mode of each file
// directly in the `bin/` of that plugin. The repositories are real, made with `git init`.
// The files glob and the decoy files are in tests/configs.test.ts.
import { chmodSync, symlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { git, plain, repo } from '../git-tree.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const RULE = 'plugin-bin-executable'
const MANIFEST = '.claude-plugin/plugin.json'
const lint = (root: string, file = MANIFEST, code = '{"name":"p"}') =>
  lintJson(RULE, code, path.join(root, file))
const files = (messages: ReturnType<typeof lint>) =>
  messages.map((m) => (m.message.match(/"([^"]+)"/) ?? [])[1])

describe(RULE, () => {
  it.fails('reports a file in bin/ with mode 100644, at the start of the manifest', () => {
    const root = repo({ [MANIFEST]: '{"name":"p"}', 'bin/tool': '#!/bin/sh\n' })
    const messages = lint(root)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'notExecutable',
      line: 1,
      column: 1,
    })
    expect(files(messages)).toEqual(['bin/tool'])
  })

  it.fails('stays silent for a file with mode 100755', () => {
    const root = repo({ [MANIFEST]: '{}', 'bin/tool': '#!/bin/sh\n' }, ['bin/tool'])
    expect(lint(root)).toEqual([])
  })

  it.fails('reports each file with mode 100644, in name order, and not the others', () => {
    const root = repo(
      { [MANIFEST]: '{}', 'bin/zeta': 'x', 'bin/alpha': 'x', 'bin/ok': 'x', 'bin/Beta': 'x' },
      ['bin/ok'],
    )
    expect(files(lint(root))).toEqual(['bin/alpha', 'bin/Beta', 'bin/zeta'])
  })

  it.fails('stays silent for a hidden file, a nested file and a file outside bin/', () => {
    const root = repo({
      [MANIFEST]: '{}',
      'bin/.gitkeep': '',
      'bin/lib/helper': 'x',
      'binary/tool': 'x',
      'scripts/tool': 'x',
    })
    expect(lint(root)).toEqual([])
  })

  it.fails('stays silent for a file that git does not track', () => {
    const root = repo({ [MANIFEST]: '{}', 'a.txt': 'x' }, [], { 'bin/loose': '#!/bin/sh\n' })
    expect(lint(root)).toEqual([])
  })

  it.fails('stays silent for a plugin with no bin/, or a bin that is a file', () => {
    expect(lint(repo({ [MANIFEST]: '{}' }))).toEqual([])
    expect(lint(repo({ [MANIFEST]: '{}', bin: 'x' }))).toEqual([])
  })

  it.fails('reads the index mode, not the disk mode', () => {
    const root = repo({ [MANIFEST]: '{}', 'bin/a': 'x', 'bin/b': 'x' }, ['bin/a'])
    chmodSync(path.join(root, 'bin/a'), 0o644)
    chmodSync(path.join(root, 'bin/b'), 0o755)
    expect(files(lint(root))).toEqual(['bin/b'])
  })

  it.fails('reads the mode that a later git update-index records', () => {
    const root = repo({ [MANIFEST]: '{}', 'bin/tool': 'x' })
    expect(lint(root)).toHaveLength(1)
    git(root, 'update-index', '--chmod=+x', 'bin/tool')
    expect(lint(root)).toEqual([])
  })

  it.fails('finds the plugin root in a directory of the repository', () => {
    const root = repo({ 'plugins/p/.claude-plugin/plugin.json': '{}', 'plugins/p/bin/tool': 'x' })
    expect(files(lint(root, 'plugins/p/.claude-plugin/plugin.json'))).toEqual(['bin/tool'])
  })

  it.fails('reads only the bin/ of its own plugin', () => {
    const root = repo({
      'plugins/p/.claude-plugin/plugin.json': '{}',
      'plugins/q/.claude-plugin/plugin.json': '{}',
      'plugins/q/bin/tool': 'x',
      'bin/tool': 'x',
    })
    expect(lint(root, 'plugins/p/.claude-plugin/plugin.json')).toEqual([])
  })

  it.fails('stays silent in a tree with no .git, where the mode cannot be read', () => {
    const root = plain({ [MANIFEST]: '{}', 'bin/tool': 'x' })
    expect(lint(root)).toEqual([])
  })

  it.fails('stays silent when git cannot run', () => {
    const root = repo({ [MANIFEST]: '{}', 'bin/tool': 'x' })
    vi.stubEnv('PATH', '')
    try {
      expect(lint(root)).toEqual([])
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it.fails('stays silent for a manifest that is in no plugin root', () => {
    // The linted text is a virtual file. No `plugin.json` is on disk, so no plugin is there.
    const root = repo({ 'bin/tool': 'x' })
    expect(lint(root)).toEqual([])
  })

  it.fails('reads a bin/ that is a link to a directory of the repository', () => {
    const root = repo({ [MANIFEST]: '{}', 'shared/tool': 'x' })
    symlinkSync('shared', path.join(root, 'bin'))
    expect(files(lint(root))).toEqual(['bin/tool'])
  })

  it.fails('stays silent for a bin/ that leads out of the repository', () => {
    const root = repo({ [MANIFEST]: '{}' })
    const outside = repo({ tool: 'x' })
    symlinkSync(outside, path.join(root, 'bin'))
    expect(lint(root)).toEqual([])
  })

  it.fails('stays silent for a bin/ that is a dangling link', () => {
    const root = repo({ [MANIFEST]: '{}' })
    symlinkSync('missing', path.join(root, 'bin'))
    expect(lint(root)).toEqual([])
  })

  it.fails('stays silent for a link in bin/, which has its own git mode', () => {
    const root = repo({ [MANIFEST]: '{}', 'bin/real': 'x' }, ['bin/real'])
    symlinkSync('real', path.join(root, 'bin/alias'))
    git(root, 'add', '--force', 'bin/alias')
    expect(lint(root)).toEqual([])
  })

  describe('when .claude-plugin is a link', () => {
    it.fails('stays silent when its real path is out of the repository', () => {
      const root = repo({ 'bin/tool': 'x' })
      const outside = plain({ 'plugin.json': '{}' })
      symlinkSync(outside, path.join(root, '.claude-plugin'))
      expect(lint(root)).toEqual([])
    })
  })
})
