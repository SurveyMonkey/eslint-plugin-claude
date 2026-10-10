// Claude Code treats a symlink whose target is outside the working directory like an external
// import. The linked rules do not load until you approve external imports for the project
// (https://code.claude.com/docs/en/memory#share-rules-across-projects-with-symlinks). The rule
// asks where each part of the path of a rule file leads, from the `.claude` folder down. It reads
// nothing in the target, because ESLint gave it the text. A link that leads nowhere and a path
// that it cannot read give no report. The globs are in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, lintMemory, noLinks, tree } from '../memory-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'rules-symlink-external'

const PLAIN = '# Rule\n\nValidate input at the boundary.\n'
const SCOPED = '---\npaths:\n  - "src/**/*.ts"\n---\n# Rule\n'
const FILE = '.claude/rules/a.md'

/** The messages for a rule file that links to a file out of its repository. The text of the
 *  file is `code`. The file is `.claude/rules/a.md` unless `file` says another. */
function outside(code: string, options: { git?: boolean; file?: string } = {}) {
  const { git = true, file = FILE } = options
  const elsewhere = tree({ 'shared/a.md': code })
  const dir = tree({}, git)
  link(dir, file, path.join(elsewhere, 'shared/a.md'))
  return lintMemory(RULE, dir, file, code)
}

const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

describe.skipIf(noLinks)(RULE, () => {
  it.fails('reports a rule file that is a link out of the repository, at the start', () => {
    const messages = outside(PLAIN)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'external',
      line: 1,
      column: 1,
    })
    expect(messages[0]?.message).toContain('`.claude/rules/a.md`')
  })

  it.fails('reports a rule file in a folder below .claude/rules, and in a nested .claude', () => {
    expect(ids(outside(PLAIN, { file: '.claude/rules/sub/deep/b.md' }))).toEqual(['external'])
    expect(ids(outside(PLAIN, { file: 'packages/web/.claude/rules/c.md' }))).toEqual(['external'])
  })

  it.fails('reports a link to a folder, at the link, for a file below it', () => {
    const elsewhere = tree({ 'rules/sub/b.md': PLAIN })
    const dir = tree({})
    link(dir, '.claude/rules/shared', path.join(elsewhere, 'rules'))
    const messages = lintMemory(RULE, dir, '.claude/rules/shared/sub/b.md', PLAIN)
    expect(ids(messages)).toEqual(['external'])
    expect(messages[0]?.message).toContain('`.claude/rules/shared`')
    expect(messages[0]?.message).not.toContain('b.md')
  })

  it.fails('reports the .claude/rules folder when it is a link', () => {
    const elsewhere = tree({ 'rules/sub/b.md': PLAIN })
    const dir = tree({})
    link(dir, '.claude/rules', path.join(elsewhere, 'rules'))
    const messages = lintMemory(RULE, dir, '.claude/rules/sub/b.md', PLAIN)
    expect(ids(messages)).toEqual(['external'])
    expect(messages[0]?.message).toContain('`.claude/rules`')
  })

  it.fails('reports the .claude folder when it is a link', () => {
    const shared = tree({ 'rules/sub/b.md': PLAIN }, false)
    const dir = tree({})
    link(dir, '.claude', shared)
    const messages = lintMemory(RULE, dir, '.claude/rules/sub/b.md', PLAIN)
    expect(ids(messages)).toEqual(['external'])
    expect(messages[0]?.message).toContain('`.claude`')
  })

  it.fails('reports the first link out on the way, and no more', () => {
    const other = tree({ 'b.md': PLAIN })
    const elsewhere = tree({})
    link(elsewhere, 'rules/b.md', path.join(other, 'b.md'))
    const dir = tree({})
    link(dir, '.claude/rules', path.join(elsewhere, 'rules'))
    expect(lintMemory(RULE, dir, '.claude/rules/b.md', PLAIN)).toHaveLength(1)
  })

  it.fails('reports a link out that sits below a link inside the repository', () => {
    const elsewhere = tree({ 'b.md': PLAIN })
    const dir = tree({})
    link(dir, '.claude/rules/dir', '../../shared')
    link(dir, 'shared/b.md', path.join(elsewhere, 'b.md'))
    const messages = lintMemory(RULE, dir, '.claude/rules/dir/b.md', PLAIN)
    expect(ids(messages)).toEqual(['external'])
    expect(messages[0]?.message).toContain('`.claude/rules/dir/b.md`')
  })

  it.fails('stays silent on a link that leads to a file or a folder in the repository', () => {
    const dir = tree({ 'shared/a.md': PLAIN, 'shared/rules/b.md': PLAIN })
    link(dir, FILE, '../../shared/a.md')
    link(dir, '.claude/rules/dir', '../../shared/rules')
    expect(lintMemory(RULE, dir, FILE, PLAIN)).toEqual([])
    expect(lintMemory(RULE, dir, '.claude/rules/dir/b.md', PLAIN)).toEqual([])
  })

  it.fails('stays silent on a link to a folder that holds a .git, a repository of its own', () => {
    const repo = tree({ 'rules/sub/b.md': PLAIN })
    const linked = tree({})
    link(linked, '.claude', repo)
    expect(lintMemory(RULE, linked, '.claude/rules/sub/b.md', PLAIN)).toEqual([])
  })

  it.fails('stays silent on a regular file, and on a file that is not on disk', () => {
    const dir = tree({ [FILE]: PLAIN })
    expect(lintMemory(RULE, dir, FILE, PLAIN)).toEqual([])
    expect(lintMemory(RULE, tree({}), FILE, PLAIN)).toEqual([])
  })

  it.fails('does not check a file that Claude Code does not load as a rule', () => {
    const elsewhere = tree({ 'a.md': PLAIN })
    const dir = tree({})
    link(dir, 'CLAUDE.md', path.join(elsewhere, 'a.md'))
    link(dir, 'docs/a.md', path.join(elsewhere, 'a.md'))
    expect(lintMemory(RULE, dir, 'CLAUDE.md', PLAIN)).toEqual([])
    expect(lintMemory(RULE, dir, 'docs/a.md', PLAIN)).toEqual([])
  })

  it.fails('makes no report in a tree with no .git, where the end of the repository is unknown', () => {
    expect(outside(PLAIN, { git: false })).toEqual([])
  })
})

describe.skipIf(noLinks)(`${RULE}: the split with rules-symlink-external-scoped`, () => {
  it.fails('makes no report for a rule with paths, which the scoped rule reports', () => {
    expect(outside(SCOPED)).toEqual([])
    for (const paths of [
      'paths: src/**/*.ts, docs/**',
      'paths: [src/**, ""]',
      'paths:\n  - src/**',
    ]) {
      expect(outside(`---\n${paths}\n---\n# Rule\n`), paths).toEqual([])
    }
  })

  it.fails('reports a rule with no scope, or with frontmatter that sets none', () => {
    for (const code of [
      '# Rule\n',
      '---\n---\n# Rule\n',
      '---\npaths:\n---\n# Rule\n',
      '---\npaths: ""\n---\n# Rule\n',
      '---\npaths: ", ,"\n---\n# Rule\n',
      '---\npaths: []\n---\n# Rule\n',
      '---\npaths: ["", "  "]\n---\n# Rule\n',
      '---\npaths: [1, 2]\n---\n# Rule\n',
      '---\npaths: 5\n---\n# Rule\n',
      '---\nglobs: "src/**"\n---\n# Rule\n',
      // The YAML does not parse, or the block is below line 1: Claude Code reads no scope.
      '---\npaths: *.ts\n---\n# Rule\n',
      '# Rule\n\n---\npaths: "src/**"\n---\n',
    ]) {
      expect(ids(outside(code)), code).toEqual(['external'])
    }
  })

  it.fails('makes no report for a link out that leads back into the repository', () => {
    // The real path of the folder is inside the repository, so nothing is external.
    const dir = tree({ 'shared/b.md': PLAIN })
    const elsewhere = tree({})
    link(elsewhere, 'back', path.join(dir, 'shared'))
    link(dir, '.claude/rules/dir', path.join(elsewhere, 'back'))
    expect(lintMemory(RULE, dir, '.claude/rules/dir/b.md', PLAIN)).toEqual([])
  })

  it.fails('makes no report for a link to a network path, which the network rule reports', () => {
    const dir = tree({})
    link(dir, FILE, '/net/host/a.md')
    link(dir, '.claude/rules/unc', '\\\\server\\share\\rules')
    link(dir, '.claude/rules/mac', '/Network/Servers/h/rules')
    expect(lintMemory(RULE, dir, FILE, PLAIN)).toEqual([])
    expect(lintMemory(RULE, dir, '.claude/rules/unc/b.md', PLAIN)).toEqual([])
    expect(lintMemory(RULE, dir, '.claude/rules/mac/b.md', PLAIN)).toEqual([])
  })
})

describe.skipIf(noLinks)(`${RULE}: what the rule cannot read`, () => {
  it.fails('makes no report for a link that leads nowhere', () => {
    const dir = tree({})
    link(dir, FILE, '/nowhere/a.md')
    link(dir, '.claude/rules/gone', '/nowhere')
    expect(lintMemory(RULE, dir, FILE, PLAIN)).toEqual([])
    expect(lintMemory(RULE, dir, '.claude/rules/gone/b.md', PLAIN)).toEqual([])
  })

  it.skipIf(chmodCannotBlock).fails('makes no report for a path that it cannot read', () => {
    const dir = tree({ '.claude/rules/sub/b.md': PLAIN })
    withoutAccess(path.join(dir, '.claude/rules/sub'), () => {
      expect(lintMemory(RULE, dir, '.claude/rules/sub/b.md', PLAIN)).toEqual([])
    })
  })
})
