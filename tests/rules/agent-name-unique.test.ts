// Two local agent files under one `.claude/agents/` tree must not share a
// `name`. The tree is on disk, because the rule reads the other files.
import { mkdirSync, rmSync, symlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import rule from '../../src/rules/agent-name-unique.ts'
import { agent, lintWith, repo } from '../agent-settings.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

// `realpathSync` is the one boundary that the `UNREADABLE` case of `realOf` needs. A real file
// system cannot make it fail for one file and not for another on every platform. Each call goes
// to the real function, except where a test sets `realpathFails`.
const realpathFails = vi.hoisted(() => ({ path: null as string | null }))
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  const realpathSync = Object.assign(
    (file: string, ...rest: unknown[]) => {
      if (realpathFails.path !== null && String(file) === realpathFails.path) {
        throw Object.assign(new Error('permission denied'), { code: 'EACCES' })
      }
      return (actual.realpathSync as (...args: unknown[]) => string)(file, ...rest)
    },
    { native: actual.realpathSync.native },
  )
  return { ...actual, default: { ...actual, realpathSync }, realpathSync }
})

const lint = (root: string, at: string, code?: string) =>
  lintWith(rule, code ?? agent('', 'dup'), path.join(root, at))
const PLUGIN = { '.claude-plugin/plugin.json': '{}' }

describe('agent-name-unique', () => {
  it('reports a file whose name another file of the tree declares', () => {
    const root = repo({ '.claude/agents/b.md': agent('', 'dup') })
    const messages = lint(root, '.claude/agents/a.md')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ messageId: 'duplicate', line: 2, column: 7, endColumn: 10 })
    expect(messages[0]?.message).toContain('`b.md`')
  })

  it('reports each file of the duplicate', () => {
    const root = repo({
      '.claude/agents/a.md': agent('', 'dup'),
      '.claude/agents/b.md': agent('', 'dup'),
    })
    expect(lint(root, '.claude/agents/b.md')).toHaveLength(1)
    expect(lint(root, '.claude/agents/a.md')).toHaveLength(1)
  })

  it('lists every other file of the duplicate, in order', () => {
    const root = repo({
      '.claude/agents/b.md': agent('', 'dup'),
      '.claude/agents/c.md': agent('', 'dup'),
    })
    const messages = lint(root, '.claude/agents/a.md')
    expect(messages[0]?.message).toContain('`b.md`, `c.md`')
  })

  it('stays silent for a file that is the only file of its name, on disk', () => {
    const root = repo({ '.claude/agents/a.md': agent('', 'dup') })
    expect(lint(root, '.claude/agents/a.md')).toEqual([])
  })

  it('does not report a file as a duplicate of itself when it is reached by a directory link', () => {
    const root = repo({ '.claude/agents/real/a.md': agent('', 'dup') })
    symlinkSync(path.join(root, '.claude/agents/real'), path.join(root, '.claude/agents/link'))
    expect(lint(root, '.claude/agents/link/a.md')).toEqual([])
  })

  it('reports a duplicate in a subfolder', () => {
    const root = repo({ '.claude/agents/review/b.md': agent('', 'dup') })
    const messages = lint(root, '.claude/agents/a.md')
    expect(messages).toHaveLength(1)
    expect(messages[0]?.message).toContain('`review/b.md`')
  })

  it('reports a file in a subfolder', () => {
    const root = repo({ '.claude/agents/b.md': agent('', 'dup') })
    expect(lint(root, '.claude/agents/x/y/a.md')).toHaveLength(1)
  })

  it('stays silent for different names', () => {
    const root = repo({ '.claude/agents/b.md': agent('', 'other') })
    expect(lint(root, '.claude/agents/a.md')).toEqual([])
  })

  it('stays silent when the names differ in case', () => {
    const root = repo({ '.claude/agents/b.md': agent('', 'DUP') })
    expect(lint(root, '.claude/agents/a.md')).toEqual([])
  })

  it('stays silent for the same name in another .claude directory', () => {
    const root = repo({ 'pkg/.claude/agents/b.md': agent('', 'dup') })
    expect(lint(root, '.claude/agents/a.md')).toEqual([])
  })

  it('stays silent for a plugin agent', () => {
    const root = repo({ ...PLUGIN, 'agents/b.md': agent('', 'dup') })
    expect(lint(root, 'agents/a.md')).toEqual([])
  })

  it('does not count a plugin file as a duplicate of a local agent', () => {
    const root = repo({ ...PLUGIN, '.claude/agents/b.md': agent('', 'dup') })
    expect(lint(root, 'agents/a.md')).toEqual([])
  })

  it('stays silent for a file that is no agent file', () => {
    const root = repo({ 'docs/b.md': agent('', 'dup') })
    expect(lint(root, 'docs/a.md')).toEqual([])
  })

  for (const given of ['123', '[a]', '""', 'true']) {
    it(`stays silent for the name ${given}, which is no name`, () => {
      const root = repo({ '.claude/agents/b.md': agent('', given) })
      expect(lint(root, '.claude/agents/a.md', agent('', given))).toEqual([])
    })
  }

  it('stays silent for a file with no name', () => {
    const root = repo({ '.claude/agents/b.md': '---\ndescription: d\n---\n' })
    expect(lint(root, '.claude/agents/a.md', '---\ndescription: d\n---\n')).toEqual([])
  })

  it('stays silent for a file with no frontmatter', () => {
    const root = repo({ '.claude/agents/b.md': agent('', 'dup') })
    expect(lint(root, '.claude/agents/a.md', 'No frontmatter.\n')).toEqual([])
  })

  it('stays silent for a file whose frontmatter does not parse', () => {
    const root = repo({ '.claude/agents/b.md': agent('', 'dup') })
    expect(lint(root, '.claude/agents/a.md', '---\nname: [dup\n---\n')).toEqual([])
  })

  it('ignores another file whose frontmatter does not parse', () => {
    const root = repo({ '.claude/agents/b.md': '---\nname: [dup\n---\n' })
    expect(lint(root, '.claude/agents/a.md')).toEqual([])
  })

  it('ignores another file that has a name that is not a string', () => {
    const root = repo({ '.claude/agents/b.md': agent('', '123') })
    expect(lint(root, '.claude/agents/a.md', agent('', '123'))).toEqual([])
  })

  it('stays silent when the only other file is a link out of the repository', () => {
    const root = repo({})
    const out = repo({ 'b.md': agent('', 'dup') })
    mkdirSync(path.join(root, '.claude/agents'), { recursive: true })
    symlinkSync(out, path.join(root, '.claude/agents/out'))
    expect(lint(root, '.claude/agents/a.md')).toEqual([])
  })

  it('reports a duplicate that a link inside the repository leads to', () => {
    const root = repo({ 'shared/b.md': agent('', 'dup') })
    mkdirSync(path.join(root, '.claude/agents'), { recursive: true })
    symlinkSync(path.join(root, 'shared'), path.join(root, '.claude/agents/shared'))
    expect(lint(root, '.claude/agents/a.md')).toHaveLength(1)
  })

  describe('a file that the rule cannot read', () => {
    it('has no name to compare', { skip: chmodCannotBlock }, () => {
      const root = repo({
        '.claude/agents/b.md': agent('', 'dup'),
        '.claude/agents/c.md': agent('', 'dup'),
      })
      withoutAccess(path.join(root, '.claude/agents/b.md'), () => {
        const messages = lint(root, '.claude/agents/a.md')
        expect(messages).toHaveLength(1)
        expect(messages[0]?.message).toContain('`c.md`')
        expect(messages[0]?.message).not.toContain('`b.md`')
      })
    })

    it('hides a duplicate when a folder cannot be listed', () => {
      if (chmodCannotBlock) {
        return
      }
      const root = repo({ '.claude/agents/sub/b.md': agent('', 'dup') })
      withoutAccess(path.join(root, '.claude/agents/sub'), () => {
        expect(lint(root, '.claude/agents/a.md')).toEqual([])
      })
    })
  })

  it('stays silent when the real path of this file is unreadable', () => {
    const root = repo({
      '.claude/agents/a.md': agent('', 'dup'),
      '.claude/agents/b.md': agent('', 'dup'),
    })
    realpathFails.path = path.join(root, '.claude/agents/a.md')
    try {
      expect(lint(root, '.claude/agents/a.md')).toEqual([])
    } finally {
      realpathFails.path = null
    }
    // With a readable real path, the same tree reports `b.md`.
    const messages = lint(root, '.claude/agents/a.md')
    expect(messages).toHaveLength(1)
    expect(messages[0]?.message).toContain('`b.md`')
  })

  // A real path failure on a file that ESLint just read gives no real path to compare. The rule
  // cannot tell a link to the linted file from a second agent, so it makes no report.
  it('stays silent for a link to this file when the real path of this file is unreadable', {
    skip: process.platform === 'win32',
  }, () => {
    const root = repo({ '.claude/agents/a.md': agent('', 'dup') })
    symlinkSync(path.join(root, '.claude/agents/a.md'), path.join(root, '.claude/agents/alias.md'))
    realpathFails.path = path.join(root, '.claude/agents/a.md')
    try {
      expect(lint(root, '.claude/agents/a.md')).toEqual([])
    } finally {
      realpathFails.path = null
    }
  })

  // The target of a `.claude` link holds its own `.git`. It is the bound, as for the skill rules.
  it('reads the agents of a .claude link whose target holds its own .git', {
    skip: process.platform === 'win32',
  }, () => {
    const root = repo({})
    const target = repo({ 'agents/b.md': agent('', 'dup') })
    symlinkSync(target, path.join(root, '.claude'))
    expect(lint(root, '.claude/agents/a.md')).toHaveLength(1)
  })

  // A `.claude` link goes to a directory out of the repository. The rule reads no file there.
  it('makes no report for a .claude that is a link out of the repository', {
    skip: process.platform === 'win32',
  }, () => {
    const root = repo({})
    const outside = repo({ 'agents/b.md': agent('', 'dup') })
    // Remove its `.git`. The old walk from the real path would take it as the repository.
    rmSync(path.join(outside, '.git'), { recursive: true })
    symlinkSync(outside, path.join(root, '.claude'))
    expect(lint(root, '.claude/agents/a.md')).toEqual([])
  })

  it('reports for a .claude that is a real directory', () => {
    const root = repo({ '.claude/agents/b.md': agent('', 'dup') })
    expect(lint(root, '.claude/agents/a.md')).toHaveLength(1)
  })
})
