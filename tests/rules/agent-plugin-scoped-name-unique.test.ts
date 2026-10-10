// The plugin components page, "Organize agents in subfolders": the scoped
// name of a plugin agent is the plugin name, each subfolder and the file
// name, or the `name` field in place of the file name. The manifest key
// `agents` replaces the `agents/` scan, and a file that it lists loses its
// subfolders. The files are on disk.
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { agent, repo } from '../agent-settings.test-support.ts'
import { chmodCannotBlock, lintMarkdown, withoutAccess } from '../rule-tester.test-support.ts'

const PLUGIN = { '.claude-plugin/plugin.json': '{}' }
const manifest = (agents: unknown) => ({
  '.claude-plugin/plugin.json': JSON.stringify({ name: 'p', agents }),
})
const bare = '---\ndescription: d\n---\n\nBody.\n'
const lint = (root: string, at: string, code?: string) =>
  lintMarkdown('agent-plugin-scoped-name-unique', code ?? bare, path.join(root, at))

describe('agent-plugin-scoped-name-unique', () => {
  it('reports a file whose name field is the file name of another file', () => {
    const root = repo({ ...PLUGIN, 'agents/b.md': bare })
    const messages = lint(root, 'agents/a.md', agent('', 'b'))
    expect(messages).toMatchObject([{ messageId: 'duplicate', line: 2, column: 7, endColumn: 8 }])
    expect(messages[0]?.message).toContain('`<plugin>:b`')
    expect(messages[0]?.message).toContain('`agents/b.md`')
  })

  it('reports from the other side too', () => {
    const root = repo({ ...PLUGIN, 'agents/a.md': agent('', 'b') })
    expect(lint(root, 'agents/b.md')).toMatchObject([
      { messageId: 'duplicate', line: 1, column: 1, endLine: 1, endColumn: 1 },
    ])
  })

  it('reports two files with one name field', () => {
    const root = repo({ ...PLUGIN, 'agents/b.md': agent('', 'dup') })
    expect(lint(root, 'agents/a.md', agent('', 'dup'))).toHaveLength(1)
  })

  it('reports a duplicate in one subfolder, and lists the other files in order', () => {
    const root = repo({
      ...PLUGIN,
      'agents/review/b.md': agent('', 'dup'),
      'agents/review/c.md': agent('', 'dup'),
    })
    const messages = lint(root, 'agents/review/a.md', agent('', 'dup'))
    expect(messages[0]?.message).toContain('`<plugin>:review:dup`')
    expect(messages[0]?.message).toContain('`agents/review/b.md`, `agents/review/c.md`')
  })

  it('stays silent for the same name in two subfolders', () => {
    const root = repo({ ...PLUGIN, 'agents/review/security.md': bare })
    expect(lint(root, 'agents/security.md')).toEqual([])
    expect(lint(root, 'agents/other/security.md')).toEqual([])
  })

  it('stays silent for scoped names that differ', () => {
    const root = repo({ ...PLUGIN, 'agents/b.md': bare })
    expect(lint(root, 'agents/a.md', agent('', 'c'))).toEqual([])
    expect(lint(root, 'agents/a.md')).toEqual([])
  })

  it('stays silent when the names differ in case', () => {
    const root = repo({ ...PLUGIN, 'agents/b.md': agent('', 'B') })
    expect(lint(root, 'agents/a.md', agent('', 'b'))).toEqual([])
  })

  it('names a file with no frontmatter, or bad YAML, after the file', () => {
    const root = repo({ ...PLUGIN, 'agents/b.md': 'No frontmatter.\n' })
    expect(lint(root, 'agents/a.md', agent('', 'b'))).toHaveLength(1)
    expect(lint(root, 'agents/a.md', '---\nname: [x\n---\n')).toEqual([])
    const bad = repo({ ...PLUGIN, 'agents/b.md': bare })
    expect(lint(bad, 'agents/b.md', '---\nname: [x\n---\n')).toEqual([])
    const other = repo({ ...PLUGIN, 'agents/a.md': bare })
    expect(lint(other, 'agents/a.md', '---\nname: [x\n---\n')).toEqual([])
  })

  it('reports a file with bad YAML whose file name is the name of another file', () => {
    const root = repo({ ...PLUGIN, 'agents/b.md': '---\nname: a\n---\n' })
    const messages = lint(root, 'agents/a.md', '---\nname: [x\n---\n')
    expect(messages).toMatchObject([{ messageId: 'duplicate', line: 1, column: 1 }])
  })

  it('names a file with an empty name field after the file', () => {
    const other = repo({ ...PLUGIN, 'agents/b.md': agent('', '""') })
    expect(lint(other, 'agents/a.md', agent('', 'b'))).toHaveLength(1)
    const own = repo({ ...PLUGIN, 'agents/b.md': agent('', 'a') })
    expect(lint(own, 'agents/a.md', agent('', '""'))).toHaveLength(1)
  })

  it('uses the file name for an empty name, or a name that is not a string', () => {
    const root = repo({ ...PLUGIN, 'agents/b.md': agent('', '""') })
    expect(lint(root, 'agents/a.md', agent('', '""'))).toEqual([])
    const other = repo({ ...PLUGIN, 'agents/a.md': agent('', '123') })
    expect(lint(other, 'agents/b.md', agent('', '123'))).toEqual([])
    const twin = repo({ ...PLUGIN, 'agents/a.md': agent('', '[x]') })
    expect(lint(twin, 'agents/b.md', agent('', 'a'))).toHaveLength(1)
  })

  it('names an empty file after the file', () => {
    const root = repo({ ...PLUGIN, 'agents/b.md': agent('', 'a') })
    expect(lint(root, 'agents/a.md', '')).toHaveLength(1)
  })

  it('reports a name that holds a colon as the joined name', () => {
    const root = repo({ ...PLUGIN, 'agents/review/security.md': bare })
    const messages = lint(root, 'agents/a.md', agent('', 'review:security'))
    expect(messages).toHaveLength(1)
  })

  it('stays silent for a local agent', () => {
    const root = repo({ '.claude/agents/b.md': agent('', 'dup') })
    expect(lint(root, '.claude/agents/a.md', agent('', 'dup'))).toEqual([])
  })

  it('stays silent for a file that is no agent file', () => {
    const root = repo({ ...PLUGIN, 'docs/b.md': agent('', 'dup') })
    expect(lint(root, 'docs/a.md', agent('', 'dup'))).toEqual([])
  })

  it('stays silent for a plugin agent that is not at the root of its plugin', () => {
    const root = repo({ ...PLUGIN, 'agents/b.md': agent('', 'dup') })
    expect(lint(root, 'other/agents/a.md', agent('', 'dup'))).toEqual([])
  })

  it('ignores a local agent in the same repository', () => {
    const root = repo({ ...PLUGIN, '.claude/agents/b.md': agent('', 'dup') })
    expect(lint(root, 'agents/a.md', agent('', 'dup'))).toEqual([])
  })

  describe('the manifest key agents', () => {
    it('replaces the scan, so a file that the key does not list gives no report', () => {
      const root = repo({
        ...manifest(['./agents/b.md']),
        'agents/b.md': bare,
        'agents/a.md': agent('', 'b'),
      })
      expect(lint(root, 'agents/a.md', agent('', 'b'))).toEqual([])
    })

    it('reports two listed files that lose their subfolders and share a file name', () => {
      const root = repo({
        ...manifest(['./agents/review/security.md', './agents/security.md']),
        'agents/review/security.md': bare,
        'agents/security.md': bare,
      })
      const messages = lint(root, 'agents/security.md')
      expect(messages).toMatchObject([{ messageId: 'duplicate' }])
      expect(messages[0]?.message).toContain('`<plugin>:security`')
      expect(messages[0]?.message).toContain('`agents/review/security.md`')
      expect(lint(root, 'agents/review/security.md')).toHaveLength(1)
    })

    it('reads a key that holds one path', () => {
      const root = repo({
        ...manifest('./agents/b.md'),
        'agents/b.md': bare,
      })
      expect(lint(root, 'agents/b.md')).toEqual([])
    })

    it('reports a listed file and a listed file elsewhere with one name', () => {
      const root = repo({
        ...manifest(['./agents/a.md', './custom/a.md']),
        'agents/a.md': bare,
        'custom/a.md': bare,
      })
      expect(lint(root, 'agents/a.md')).toHaveLength(1)
    })

    it('stays silent when the listed files differ', () => {
      const root = repo({
        ...manifest(['./agents/review/security.md', './agents/other.md']),
        'agents/review/security.md': bare,
        'agents/other.md': bare,
      })
      expect(lint(root, 'agents/other.md')).toEqual([])
    })

    it('ignores an entry that is not a string, not a .md file, or not inside the plugin', () => {
      const same = agent('', 'a')
      const root = repo({
        ...manifest([
          './agents/a.md',
          null,
          7,
          ['./agents/b.md'],
          './agents',
          './agents/missing.md',
          '../outside.md',
          './notes.txt',
        ]),
        'agents/a.md': bare,
        'agents/b.md': same,
        'notes.txt': same,
      })
      writeFileSync(path.join(path.dirname(root), 'outside.md'), same)
      expect(lint(root, 'agents/a.md')).toEqual([])
    })

    it('ignores a listed link that leads out of the plugin', () => {
      const out = repo({ 'a.md': bare })
      const root = repo({
        ...manifest(['./agents/a.md', './link.md']),
        'agents/a.md': bare,
      })
      symlinkSync(path.join(out, 'a.md'), path.join(root, 'link.md'))
      expect(lint(root, 'agents/a.md')).toEqual([])
    })

    it('stays silent for a key that is neither a path nor a list', () => {
      for (const value of [{ a: './agents/a.md' }, 3, null, true]) {
        const root = repo({
          ...manifest(value),
          'agents/a.md': bare,
          'agents/b.md': agent('', 'a'),
        })
        expect(lint(root, 'agents/b.md', agent('', 'a'))).toEqual([])
      }
    })

    it('is not the key when the manifest sets other keys', () => {
      const root = repo({
        '.claude-plugin/plugin.json': '{"name":"p","skills":"./s"}',
        'agents/b.md': bare,
      })
      expect(lint(root, 'agents/a.md', agent('', 'b'))).toHaveLength(1)
    })
  })

  describe('a manifest that the rule cannot read', () => {
    it('gives no report when the manifest does not parse', () => {
      const root = repo({ '.claude-plugin/plugin.json': '{bad', 'agents/b.md': bare })
      expect(lint(root, 'agents/a.md', agent('', 'b'))).toEqual([])
    })

    it('gives no report when the manifest is not an object', () => {
      const root = repo({ '.claude-plugin/plugin.json': '[]', 'agents/b.md': bare })
      expect(lint(root, 'agents/a.md', agent('', 'b'))).toEqual([])
    })

    it('gives no report when .claude-plugin is a link out of the repository', () => {
      const root = repo({ 'agents/b.md': bare })
      const out = repo({ 'plugin.json': '{}' })
      symlinkSync(out, path.join(root, '.claude-plugin'))
      expect(lint(root, 'agents/a.md', agent('', 'b'))).toEqual([])
    })
  })

  describe('a file that the rule cannot read', () => {
    it('has no name to compare', { skip: chmodCannotBlock }, () => {
      const root = repo({
        ...PLUGIN,
        'agents/b.md': bare,
        'agents/c.md': agent('', 'b'),
      })
      withoutAccess(path.join(root, 'agents/b.md'), () => {
        const messages = lint(root, 'agents/a.md', agent('', 'b'))
        expect(messages).toHaveLength(1)
        expect(messages[0]?.message).toContain('`agents/c.md`')
        expect(messages[0]?.message).not.toContain('`agents/b.md`')
      })
    })

    it('hides a duplicate when a folder cannot be listed', { skip: chmodCannotBlock }, () => {
      const root = repo({ ...PLUGIN, 'agents/sub/b.md': agent('', 'sub:x') })
      withoutAccess(path.join(root, 'agents/sub'), () => {
        expect(lint(root, 'agents/a.md', agent('', 'sub:x'))).toEqual([])
      })
    })
  })
})

describe('agent-plugin-scoped-name-unique, more cases', () => {
  it('does not take a name that is a number for the file name', () => {
    const root = repo({ ...PLUGIN, 'agents/123.md': bare })
    expect(lint(root, 'agents/b.md', agent('', '123'))).toEqual([])
  })

  it('ignores a listed file that is in the repository but out of the plugin', () => {
    const root = repo({
      'plugins/p/.claude-plugin/plugin.json': JSON.stringify({
        agents: ['./agents/a.md', '../q/agents/a.md'],
      }),
      'plugins/p/agents/a.md': bare,
      'plugins/q/agents/a.md': bare,
    })
    expect(lint(root, 'plugins/p/agents/a.md')).toEqual([])
  })

  it('ignores an agent file that is a link out of the repository', () => {
    const out = repo({ 'ext.md': agent('', 'dup') })
    const root = repo({ ...PLUGIN })
    mkdirSync(path.join(root, 'agents'), { recursive: true })
    symlinkSync(path.join(out, 'ext.md'), path.join(root, 'agents/ext.md'))
    expect(lint(root, 'agents/a.md', agent('', 'dup'))).toEqual([])
  })
})
