// The rule lints a Markdown file below `.claude/agent-memory-local/` and reports it when git
// tracks it. The repositories are real, made with `git init`. The files glob, and the same
// file in `.claude/agent-memory/`, are in tests/configs.test.ts.
import { symlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { git, isolateGitConfig, plain, put, repo } from '../git-tree.test-support.ts'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const RULE = 'memory-agent-memory-local-untracked'
const MEMORY = '.claude/agent-memory-local/reviewer/MEMORY.md'
isolateGitConfig()
// Each case starts `git`, and a busy machine needs more than the default 5 s.
vi.setConfig({ testTimeout: 30_000 })

const lint = (root: string, file = MEMORY) =>
  lintMarkdown(RULE, '# Memory\n', path.join(root, file))

describe(RULE, () => {
  it('reports a tracked file, at the start, and names its path from the repository', () => {
    const root = repo({ [MEMORY]: '# Memory\n' })
    const messages = lint(root)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'tracked',
      line: 1,
      column: 1,
    })
    expect(messages[0]?.message).toContain(`"${MEMORY}"`)
  })

  it('reports each tracked file on its own, at any depth', () => {
    const root = repo({
      '.claude/agent-memory-local/reviewer/topic.md': 'x',
      '.claude/agent-memory-local/reviewer/deep/er/note.md': 'x',
    })
    for (const file of [
      '.claude/agent-memory-local/reviewer/topic.md',
      '.claude/agent-memory-local/reviewer/deep/er/note.md',
    ]) {
      expect(lint(root, file).map((m) => m.messageId)).toEqual(['tracked'])
    }
  })

  it('reports a tracked file that a .gitignore pattern covers', () => {
    const root = repo({ [MEMORY]: 'x', '.gitignore': '.claude/agent-memory-local/\n' })
    expect(lint(root).map((m) => m.messageId)).toEqual(['tracked'])
  })

  it('reports in a project below the root, and names the path from the repository', () => {
    const file = 'packages/a/.claude/agent-memory-local/reviewer/MEMORY.md'
    const root = repo({ [file]: 'x' })
    expect(lint(root, file)[0]?.message).toContain(`"${file}"`)
  })

  it('takes a path with a space, a dash at the start and a colon at the start as literal', () => {
    for (const dir of ['my dir', '-pkg', ':(top)pkg']) {
      const file = `${dir}/.claude/agent-memory-local/r/MEMORY.md`
      const root = repo({ [file]: 'x' })
      expect(
        lint(root, file).map((m) => m.messageId),
        dir,
      ).toEqual(['tracked'])
    }
  })

  it('stays silent for a file that git does not track', () => {
    const root = repo({ 'a.txt': 'x' }, [], { [MEMORY]: 'x' })
    expect(lint(root)).toEqual([])
  })

  it('stays silent for a file whose index entry is only a sibling of the same name', () => {
    const root = repo({ '.claude/agent-memory-local/reviewer/MEMORY.md.bak': 'x' }, [], {
      [MEMORY]: 'x',
    })
    expect(lint(root)).toEqual([])
  })

  it('stays silent in a tree with no .git, where git cannot answer', () => {
    const root = plain({ [MEMORY]: 'x' })
    expect(lint(root)).toEqual([])
  })

  it('stays silent when git cannot run', () => {
    const root = repo({ [MEMORY]: 'x' })
    vi.stubEnv('PATH', '')
    try {
      expect(lint(root)).toEqual([])
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('stays silent when git reads an outer repository', () => {
    const outer = repo({ [`inner/${MEMORY}`]: 'x' })
    put(outer, { 'inner/.git/keep': '' })
    expect(git(path.join(outer, 'inner'), 'rev-parse', '--show-toplevel').trim()).toBe(outer)
    expect(lint(outer, `inner/${MEMORY}`)).toEqual([])
  })

  describe('when the memory directory is a link', () => {
    it.skipIf(process.platform === 'win32')(
      'stays silent when its real path is out of the repository',
      () => {
        const root = repo({ 'a.txt': 'x' })
        const outside = plain({ 'reviewer/MEMORY.md': 'x' })
        put(root, { '.claude/keep': '' })
        symlinkSync(outside, path.join(root, '.claude/agent-memory-local'))
        expect(lint(root)).toEqual([])
      },
    )

    it.skipIf(process.platform === 'win32')(
      'reads a link to a directory of the repository where it leads',
      () => {
        const root = repo({ 'shared/reviewer/MEMORY.md': 'x' })
        put(root, { '.claude/keep': '' })
        symlinkSync('../shared', path.join(root, '.claude/agent-memory-local'))
        expect(lint(root).map((m) => m.messageId)).toEqual(['tracked'])
      },
    )
  })
})
