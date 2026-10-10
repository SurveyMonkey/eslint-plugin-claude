// The sub-agents page, "Choose the subagent scope": project subagents are
// found from the working directory up to the repository root. When several
// of these directories define one `name`, the closest one wins. The files
// are on disk, because the rule reads the agents of the folders above. The
// rule reports in the nearer file, the one that wins.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { agent, repo } from '../agent-settings.test-support.ts'
import { chmodCannotBlock, lintMarkdown, withoutAccess } from '../rule-tester.test-support.ts'

const PLUGIN = { '.claude-plugin/plugin.json': '{}' }
const lint = (root: string, at: string, code = agent('', 'dup')) =>
  lintMarkdown('agent-name-shadowing', code, path.join(root, at))

describe('agent-name-shadowing', () => {
  it('reports a nested agent with the name of an agent at the repository root', () => {
    const root = repo({ '.claude/agents/top.md': agent('', 'dup') })
    const messages = lint(root, 'pkg/.claude/agents/a.md')
    expect(messages).toMatchObject([{ messageId: 'shadows', line: 2, column: 7, endColumn: 10 }])
    expect(messages[0]?.message).toContain('`../.claude/agents/top.md`')
  })

  it('lists the agents of each folder above, nearest first', () => {
    const root = repo({
      '.claude/agents/top.md': agent('', 'dup'),
      'pkg/.claude/agents/mid.md': agent('', 'dup'),
    })
    const messages = lint(root, 'pkg/sub/.claude/agents/a.md')
    expect(messages).toHaveLength(1)
    expect(messages[0]?.message).toContain(
      '`../.claude/agents/mid.md`, `../../.claude/agents/top.md`',
    )
  })

  it('reports once when only a middle folder defines the name', () => {
    const root = repo({ 'pkg/.claude/agents/mid.md': agent('', 'dup') })
    expect(lint(root, 'pkg/sub/.claude/agents/a.md')).toHaveLength(1)
  })

  it('reads the subfolders of the agents above', () => {
    const root = repo({ '.claude/agents/review/deep/top.md': agent('', 'dup') })
    const messages = lint(root, 'pkg/.claude/agents/review/a.md')
    expect(messages).toHaveLength(1)
    expect(messages[0]?.message).toContain('`../.claude/agents/review/deep/top.md`')
  })

  it('reports the agent when a folder above holds the name twice', () => {
    const root = repo({
      '.claude/agents/one.md': agent('', 'dup'),
      '.claude/agents/two.md': agent('', 'dup'),
    })
    expect(lint(root, 'pkg/.claude/agents/a.md')[0]?.message).toContain(
      '`../.claude/agents/one.md`, `../.claude/agents/two.md`',
    )
  })

  it('stays silent for a name that no folder above uses', () => {
    const root = repo({ '.claude/agents/top.md': agent('', 'other') })
    expect(lint(root, 'pkg/.claude/agents/a.md')).toEqual([])
  })

  it('stays silent when the names differ in case', () => {
    const root = repo({ '.claude/agents/top.md': agent('', 'DUP') })
    expect(lint(root, 'pkg/.claude/agents/a.md')).toEqual([])
  })

  it('stays silent for the agent at the root, which a nested agent replaces', () => {
    const root = repo({ 'pkg/.claude/agents/b.md': agent('', 'dup') })
    expect(lint(root, '.claude/agents/a.md')).toEqual([])
  })

  it('stays silent for the same name in a sibling folder', () => {
    const root = repo({ 'other/.claude/agents/b.md': agent('', 'dup') })
    expect(lint(root, 'pkg/.claude/agents/a.md')).toEqual([])
  })

  it('stays silent for the same name in the same folder, which agent-name-unique reports', () => {
    const root = repo({ 'pkg/.claude/agents/b.md': agent('', 'dup') })
    expect(lint(root, 'pkg/.claude/agents/a.md')).toEqual([])
  })

  it('stays silent for an agents folder above that is not in a .claude folder', () => {
    const root = repo({ 'agents/top.md': agent('', 'dup') })
    expect(lint(root, 'pkg/.claude/agents/a.md')).toEqual([])
  })

  it('stays silent for a plugin agent', () => {
    const root = repo({ ...PLUGIN, '.claude/agents/top.md': agent('', 'dup') })
    expect(lint(root, 'pkg/agents/a.md')).toEqual([])
    expect(lint(root, 'agents/a.md')).toEqual([])
  })

  it('stays silent for a file that is no agent file', () => {
    const root = repo({ '.claude/agents/top.md': agent('', 'dup') })
    expect(lint(root, 'pkg/docs/a.md')).toEqual([])
  })

  for (const given of ['123', '[dup]', '""']) {
    it(`stays silent for the name ${given}, which is no name`, () => {
      const root = repo({ '.claude/agents/top.md': agent('', given) })
      expect(lint(root, 'pkg/.claude/agents/a.md', agent('', given))).toEqual([])
    })
  }

  it('stays silent for a file with no name, no frontmatter or bad YAML', () => {
    const root = repo({ '.claude/agents/top.md': agent('', 'dup') })
    expect(lint(root, 'pkg/.claude/agents/a.md', '---\ndescription: d\n---\n')).toEqual([])
    expect(lint(root, 'pkg/.claude/agents/a.md', 'No frontmatter.\n')).toEqual([])
    expect(lint(root, 'pkg/.claude/agents/a.md', '---\nname: [dup\n---\n')).toEqual([])
  })

  it('ignores an agent above with no name, no frontmatter or bad YAML', () => {
    const root = repo({
      '.claude/agents/a.md': '---\ndescription: d\n---\n',
      '.claude/agents/b.md': 'No frontmatter.\n',
      '.claude/agents/c.md': '---\nname: [dup\n---\n',
      '.claude/agents/d.md': agent('', '123'),
    })
    expect(lint(root, 'pkg/.claude/agents/a.md')).toEqual([])
  })

  it('stays silent when the agents folder above is a link out of the repository', () => {
    const root = repo({})
    const out = repo({ 'top.md': agent('', 'dup') })
    mkdirSync(path.join(root, '.claude'), { recursive: true })
    symlinkSync(out, path.join(root, '.claude/agents'))
    expect(lint(root, 'pkg/.claude/agents/a.md')).toEqual([])
  })

  it('reads an agents folder above that a link inside the repository leads to', () => {
    const root = repo({ 'shared/top.md': agent('', 'dup') })
    mkdirSync(path.join(root, '.claude'), { recursive: true })
    symlinkSync(path.join(root, 'shared'), path.join(root, '.claude/agents'))
    expect(lint(root, 'pkg/.claude/agents/a.md')).toHaveLength(1)
  })

  it('reads no folder above the repository root', () => {
    const root = repo({})
    const outer = path.dirname(root)
    mkdirSync(path.join(outer, '.claude/agents'), { recursive: true })
    writeFileSync(path.join(outer, '.claude/agents/out.md'), agent('', 'dup'))
    expect(lint(root, 'pkg/.claude/agents/a.md')).toEqual([])
  })

  describe('a repository with no .git', () => {
    const scratch = mkdtempSync(path.join(tmpdir(), 'agent-name-shadowing-'))
    afterAll(() => rmSync(scratch, { recursive: true, force: true }))

    it('reads no folder above, because the bound is the .claude folder', () => {
      mkdirSync(path.join(scratch, '.claude/agents'), { recursive: true })
      writeFileSync(path.join(scratch, '.claude/agents/top.md'), agent('', 'dup'))
      expect(lint(scratch, 'pkg/.claude/agents/a.md')).toEqual([])
    })
  })

  describe('a file that the rule cannot read', () => {
    it('has no name to compare', { skip: chmodCannotBlock }, () => {
      const root = repo({
        '.claude/agents/b.md': agent('', 'dup'),
        '.claude/agents/c.md': agent('', 'dup'),
      })
      withoutAccess(path.join(root, '.claude/agents/b.md'), () => {
        const messages = lint(root, 'pkg/.claude/agents/a.md')
        expect(messages).toHaveLength(1)
        expect(messages[0]?.message).toContain('`../.claude/agents/c.md`')
        expect(messages[0]?.message).not.toContain('b.md')
      })
    })

    it('hides a match when a folder cannot be listed', { skip: chmodCannotBlock }, () => {
      const root = repo({ '.claude/agents/sub/b.md': agent('', 'dup') })
      withoutAccess(path.join(root, '.claude/agents/sub'), () => {
        expect(lint(root, 'pkg/.claude/agents/a.md')).toEqual([])
      })
    })
  })
})
