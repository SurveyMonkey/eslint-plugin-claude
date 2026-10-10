// The output styles page, "Create a custom output style": the file name is
// the style name unless `name` is set, and a project style in a nested
// `.claude/output-styles/` directory wins over a style of the same name above
// it. The page does not say that Claude Code reads subfolders of
// `output-styles/`, so the rule reads direct children only. The files are on
// disk, because the rule reads the other styles.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { chmodCannotBlock, lintMarkdown, withoutAccess } from '../rule-tester.test-support.ts'

const style = (name: string) => `---\nname: ${name}\n---\n\nBody.\n`
const bare = '---\ndescription: d\n---\n\nBody.\n'
const PLUGIN = { '.claude-plugin/plugin.json': '{}' }
const lint = (root: string, at: string, code = style('dup')) =>
  lintMarkdown('output-style-name-unique', code, path.join(root, at))

describe('output-style-name-unique', () => {
  it('reports a nested style with the name of a style at the repository root', () => {
    const root = repo({ '.claude/output-styles/top.md': style('dup') })
    const messages = lint(root, 'pkg/.claude/output-styles/a.md')
    expect(messages).toMatchObject([{ messageId: 'shadows', line: 2, column: 7, endColumn: 10 }])
    expect(messages[0]?.message).toContain('`../.claude/output-styles/top.md`')
  })

  it('lists the styles of each folder above, nearest first', () => {
    const root = repo({
      '.claude/output-styles/top.md': style('dup'),
      'pkg/.claude/output-styles/mid.md': style('dup'),
    })
    const messages = lint(root, 'pkg/sub/.claude/output-styles/a.md')
    expect(messages).toHaveLength(1)
    expect(messages[0]?.message).toContain(
      '`../.claude/output-styles/mid.md`, `../../.claude/output-styles/top.md`',
    )
  })

  it('uses the file name when a style sets no name', () => {
    const root = repo({ '.claude/output-styles/terse.md': bare })
    expect(lint(root, 'pkg/.claude/output-styles/terse.md', bare)).toHaveLength(1)
    expect(lint(root, 'pkg/.claude/output-styles/other.md', bare)).toEqual([])
  })

  it('matches a name field to the file name of a style above', () => {
    const root = repo({ '.claude/output-styles/terse.md': 'No frontmatter.\n' })
    expect(lint(root, 'pkg/.claude/output-styles/a.md', style('terse'))).toHaveLength(1)
    expect(lint(root, 'pkg/.claude/output-styles/terse.md', 'No frontmatter.\n')).toHaveLength(1)
  })

  it('uses the file name for bad YAML, which loads under its file name', () => {
    const root = repo({ '.claude/output-styles/terse.md': '---\nname: [x\n---\n' })
    expect(lint(root, 'pkg/.claude/output-styles/terse.md', '---\nname: [x\n---\n')).toMatchObject([
      { messageId: 'shadows', line: 1, column: 1, endLine: 1, endColumn: 1 },
    ])
    expect(lint(root, 'pkg/.claude/output-styles/a.md', style('terse'))).toHaveLength(1)
  })

  it('uses the file name for an empty name field', () => {
    const root = repo({ '.claude/output-styles/terse.md': 'x\n' })
    expect(lint(root, 'pkg/.claude/output-styles/terse.md', '---\nname:\n---\n')).toHaveLength(1)
  })

  it('reports two styles of one folder with one name', () => {
    const root = repo({ '.claude/output-styles/b.md': style('dup') })
    const messages = lint(root, '.claude/output-styles/a.md')
    expect(messages).toMatchObject([{ messageId: 'duplicate', line: 2, column: 7 }])
    expect(messages[0]?.message).toContain('`.claude/output-styles/b.md`')
  })

  it('reports each style of the duplicate, and lists the others in order', () => {
    const root = repo({
      '.claude/output-styles/b.md': style('dup'),
      '.claude/output-styles/c.md': style('dup'),
    })
    expect(lint(root, '.claude/output-styles/a.md')[0]?.message).toContain(
      '`.claude/output-styles/b.md`, `.claude/output-styles/c.md`',
    )
    expect(lint(root, '.claude/output-styles/b.md')).toHaveLength(1)
  })

  it('reports a name field that is the file name of another style of the folder', () => {
    const root = repo({ '.claude/output-styles/terse.md': bare })
    expect(lint(root, '.claude/output-styles/a.md', style('terse'))).toHaveLength(1)
  })

  it('makes one report for the folder and one for the folders above', () => {
    const root = repo({
      '.claude/output-styles/top.md': style('dup'),
      'pkg/.claude/output-styles/b.md': style('dup'),
    })
    const messages = lint(root, 'pkg/.claude/output-styles/a.md')
    expect(messages.map((message) => message.messageId)).toEqual(['duplicate', 'shadows'])
  })

  it('stays silent for a name that no other style uses', () => {
    const root = repo({
      '.claude/output-styles/top.md': style('other'),
      'pkg/.claude/output-styles/b.md': style('other2'),
    })
    expect(lint(root, 'pkg/.claude/output-styles/a.md')).toEqual([])
  })

  it('stays silent when the names differ in case', () => {
    const root = repo({ '.claude/output-styles/top.md': style('DUP') })
    expect(lint(root, 'pkg/.claude/output-styles/a.md')).toEqual([])
  })

  it('stays silent for the style at the root, which a nested style replaces', () => {
    const root = repo({ 'pkg/.claude/output-styles/b.md': style('dup') })
    expect(lint(root, '.claude/output-styles/a.md')).toEqual([])
  })

  it('stays silent for the same name in a sibling folder', () => {
    const root = repo({ 'other/.claude/output-styles/b.md': style('dup') })
    expect(lint(root, 'pkg/.claude/output-styles/a.md')).toEqual([])
  })

  it('reads direct children only', () => {
    const root = repo({
      '.claude/output-styles/sub/b.md': style('dup'),
      'pkg/.claude/output-styles/sub/c.md': style('dup'),
    })
    expect(lint(root, 'pkg/.claude/output-styles/a.md')).toEqual([])
    // A style in a subfolder is no style file for the rule.
    expect(lint(root, 'pkg/.claude/output-styles/sub/c.md')).toEqual([])
  })

  it('ignores a file that is not Markdown, and a folder with a .md name', () => {
    const root = repo({
      '.claude/output-styles/b.txt': style('dup'),
      '.claude/output-styles/c.md/x.md': style('dup'),
    })
    expect(lint(root, 'pkg/.claude/output-styles/a.md')).toEqual([])
  })

  it('stays silent for a style folder above that is not in a .claude folder', () => {
    const root = repo({ 'output-styles/top.md': style('dup') })
    expect(lint(root, 'pkg/.claude/output-styles/a.md')).toEqual([])
  })

  it('stays silent for a plugin style', () => {
    const root = repo({
      ...PLUGIN,
      'output-styles/b.md': style('dup'),
      '.claude/output-styles/c.md': style('dup'),
    })
    expect(lint(root, 'output-styles/a.md')).toEqual([])
  })

  it('stays silent for a file that is no style file', () => {
    const root = repo({ '.claude/output-styles/b.md': style('dup') })
    expect(lint(root, 'docs/a.md')).toEqual([])
  })

  for (const given of ['123', '[dup]', '""', 'true']) {
    it(`stays silent for the name ${given}, which is no name`, () => {
      const root = repo({
        '.claude/output-styles/b.md': style(given),
        'pkg/.claude/output-styles/c.md': style(given),
      })
      expect(lint(root, 'pkg/.claude/output-styles/a.md', style(given))).toEqual([])
    })
  }

  it('ignores another style with a name that is not a string', () => {
    const root = repo({ '.claude/output-styles/dup.md': style('123') })
    expect(lint(root, 'pkg/.claude/output-styles/a.md')).toEqual([])
  })

  it('stays silent for a link out of the repository', () => {
    const root = repo({})
    const out = repo({ 'b.md': style('dup') })
    mkdirSync(path.join(root, '.claude/output-styles'), { recursive: true })
    symlinkSync(path.join(out, 'b.md'), path.join(root, '.claude/output-styles/b.md'))
    expect(lint(root, '.claude/output-styles/a.md')).toEqual([])
  })

  it('stays silent for a link that leads nowhere', () => {
    const root = repo({})
    mkdirSync(path.join(root, '.claude/output-styles'), { recursive: true })
    symlinkSync(path.join(root, 'gone.md'), path.join(root, '.claude/output-styles/b.md'))
    expect(lint(root, '.claude/output-styles/a.md')).toEqual([])
  })

  it('stays silent for a link to a folder', () => {
    const root = repo({ 'shared/x.md': style('dup') })
    mkdirSync(path.join(root, '.claude/output-styles'), { recursive: true })
    symlinkSync(path.join(root, 'shared'), path.join(root, '.claude/output-styles/dir.md'))
    expect(lint(root, '.claude/output-styles/a.md')).toEqual([])
  })

  it('reports a link to a style inside the repository', () => {
    const root = repo({ 'shared/b.md': style('dup') })
    mkdirSync(path.join(root, '.claude/output-styles'), { recursive: true })
    symlinkSync(path.join(root, 'shared/b.md'), path.join(root, '.claude/output-styles/b.md'))
    expect(lint(root, '.claude/output-styles/a.md')).toHaveLength(1)
  })

  it('stays silent when the style folder above is a link out of the repository', () => {
    const root = repo({})
    const out = repo({ 'top.md': style('dup') })
    mkdirSync(path.join(root, '.claude'), { recursive: true })
    symlinkSync(out, path.join(root, '.claude/output-styles'))
    expect(lint(root, 'pkg/.claude/output-styles/a.md')).toEqual([])
  })

  it('reads no folder above the repository root', () => {
    const root = repo({})
    const outer = path.dirname(root)
    mkdirSync(path.join(outer, '.claude/output-styles'), { recursive: true })
    writeFileSync(path.join(outer, '.claude/output-styles/out.md'), style('dup'))
    expect(lint(root, 'pkg/.claude/output-styles/a.md')).toEqual([])
  })

  describe('a repository with no .git', () => {
    const scratch = mkdtempSync(path.join(tmpdir(), 'output-style-name-unique-'))
    afterAll(() => rmSync(scratch, { recursive: true, force: true }))

    it('reads no folder above, because the bound is the output-styles folder', () => {
      mkdirSync(path.join(scratch, '.claude/output-styles'), { recursive: true })
      writeFileSync(path.join(scratch, '.claude/output-styles/top.md'), style('dup'))
      expect(lint(scratch, 'pkg/.claude/output-styles/a.md')).toEqual([])
    })
  })

  describe('a file that the rule cannot read', () => {
    it('has no name to compare', { skip: chmodCannotBlock }, () => {
      const root = repo({
        '.claude/output-styles/b.md': style('dup'),
        '.claude/output-styles/c.md': style('dup'),
      })
      withoutAccess(path.join(root, '.claude/output-styles/b.md'), () => {
        const messages = lint(root, 'pkg/.claude/output-styles/a.md')
        expect(messages).toHaveLength(1)
        expect(messages[0]?.message).toContain('c.md')
        expect(messages[0]?.message).not.toContain('b.md')
      })
    })

    it('hides a match when the folder cannot be listed', { skip: chmodCannotBlock }, () => {
      const root = repo({ '.claude/output-styles/b.md': style('dup') })
      withoutAccess(path.join(root, '.claude/output-styles'), () => {
        expect(lint(root, 'pkg/.claude/output-styles/a.md')).toEqual([])
      })
    })
  })
})

describe('output-style-name-unique, more cases', () => {
  it('stays silent for the only style of its name, which is the linted file', () => {
    const root = repo({ '.claude/output-styles/b.md': style('dup') })
    expect(lint(root, '.claude/output-styles/b.md')).toEqual([])
  })

  it('ignores a style that the rule cannot read, even when its file name is the name', {
    skip: chmodCannotBlock,
  }, () => {
    const root = repo({
      '.claude/output-styles/dup.md': bare,
      '.claude/output-styles/c.md': style('dup'),
    })
    withoutAccess(path.join(root, '.claude/output-styles/dup.md'), () => {
      const messages = lint(root, 'pkg/.claude/output-styles/a.md')
      expect(messages).toHaveLength(1)
      expect(messages[0]?.message).toContain('c.md')
      expect(messages[0]?.message).not.toContain('dup.md')
    })
  })

  it('reads a style that a link leads to inside .claude when the repository has no .git', () => {
    const scratch = mkdtempSync(path.join(tmpdir(), 'output-style-link-'))
    try {
      mkdirSync(path.join(scratch, '.claude/shared'), { recursive: true })
      mkdirSync(path.join(scratch, '.claude/output-styles'), { recursive: true })
      writeFileSync(path.join(scratch, '.claude/shared/top.md'), style('dup'))
      symlinkSync('../shared/top.md', path.join(scratch, '.claude/output-styles/top.md'))
      writeFileSync(path.join(scratch, '.claude/output-styles/a.md'), style('dup'))
      const messages = lint(scratch, '.claude/output-styles/a.md')
      expect(messages).toMatchObject([{ messageId: 'duplicate' }])
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })
})
