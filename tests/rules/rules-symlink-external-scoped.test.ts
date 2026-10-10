// A rule file that Claude Code reaches through a link out of the working directory is an
// external import. After you approve external imports, it loads only the linked rules that
// have no `paths` field. So a rule with `paths` never loads
// (https://code.claude.com/docs/en/memory#share-rules-across-projects-with-symlinks). The rule
// asks where the real path of the linted file is. It reads nothing in the target, because the
// text of the file comes from ESLint. A link that leads nowhere and a path that it cannot read
// give no report. The globs are in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, lintMemory, noLinks, tree } from '../memory-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'rules-symlink-external-scoped'

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
  it('reports the paths field of a rule that is a link out of the repository', () => {
    const messages = outside(SCOPED)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'neverLoads',
      line: 2,
      column: 1,
      endLine: 3,
      endColumn: 18,
    })
  })

  it('reports a paths field in each form that sets a scope', () => {
    for (const paths of [
      'paths: "src/**/*.ts"',
      'paths: src/**/*.ts, docs/**',
      'paths:\n  - src/**',
      'paths: [src/**, ""]',
      'paths: ["", "  ", "src/**"]',
      'paths: [1, "src/**"]',
    ]) {
      expect(ids(outside(`---\n${paths}\n---\n# Rule\n`)), paths).toEqual(['neverLoads'])
    }
  })

  it('stays silent on a rule with no scope', () => {
    for (const code of [
      '# Rule\n',
      '---\n---\n# Rule\n',
      '---\n# a comment\n---\n# Rule\n',
      '---\npaths:\n---\n# Rule\n',
      '---\npaths: ""\n---\n# Rule\n',
      '---\npaths: ", ,"\n---\n# Rule\n',
      '---\npaths: []\n---\n# Rule\n',
      '---\npaths: ["", "  "]\n---\n# Rule\n',
      '---\npaths: [1, 2]\n---\n# Rule\n',
      '---\npaths: 5\n---\n# Rule\n',
      '---\nglobs: "src/**"\n---\n# Rule\n',
    ]) {
      expect(outside(code), code).toEqual([])
    }
  })

  it('stays silent when the frontmatter is not read as frontmatter', () => {
    // The YAML does not parse, the block is below line 1, or the list is a map.
    expect(outside('---\npaths: *.ts\n---\n# Rule\n')).toEqual([])
    expect(outside('# Rule\n\n---\npaths: "src/**"\n---\n')).toEqual([])
    expect(outside('---\n- paths\n---\n# Rule\n')).toEqual([])
  })

  it('reports a rule below a link to a folder out of the repository, at each level', () => {
    const elsewhere = tree({ 'rules/sub/b.md': SCOPED })
    const dir = tree({})
    link(dir, '.claude/rules/shared', path.join(elsewhere, 'rules'))
    expect(ids(lintMemory(RULE, dir, '.claude/rules/shared/sub/b.md', SCOPED))).toEqual([
      'neverLoads',
    ])
    const rules = tree({})
    link(rules, '.claude/rules', path.join(elsewhere, 'rules'))
    expect(ids(lintMemory(RULE, rules, '.claude/rules/sub/b.md', SCOPED))).toEqual(['neverLoads'])
    // This target has no `.git`, so the bound is the linking tree.
    const shared = tree({ 'rules/sub/b.md': SCOPED }, false)
    const claude = tree({})
    link(claude, '.claude', shared)
    expect(ids(lintMemory(RULE, claude, '.claude/rules/sub/b.md', SCOPED))).toEqual(['neverLoads'])
    // A target with its own `.git` is a repository of its own. The rule reads no link out of it.
    const repo = tree({ 'rules/sub/b.md': SCOPED })
    const linked = tree({})
    link(linked, '.claude', repo)
    expect(lintMemory(RULE, linked, '.claude/rules/sub/b.md', SCOPED)).toEqual([])
  })

  it('stays silent on a link that leads to a file in the repository', () => {
    const dir = tree({ 'shared/a.md': SCOPED, 'shared/rules/b.md': SCOPED })
    link(dir, FILE, '../../shared/a.md')
    link(dir, '.claude/rules/dir', '../../shared/rules')
    expect(lintMemory(RULE, dir, FILE, SCOPED)).toEqual([])
    expect(lintMemory(RULE, dir, '.claude/rules/dir/b.md', SCOPED)).toEqual([])
  })

  it('stays silent on a rule file that is a regular file', () => {
    const dir = tree({ [FILE]: SCOPED })
    expect(lintMemory(RULE, dir, FILE, SCOPED)).toEqual([])
  })

  it('does not check a file that Claude Code does not load as a rule', () => {
    const elsewhere = tree({ 'a.md': SCOPED })
    const dir = tree({})
    link(dir, 'CLAUDE.md', path.join(elsewhere, 'a.md'))
    link(dir, 'docs/a.md', path.join(elsewhere, 'a.md'))
    expect(lintMemory(RULE, dir, 'CLAUDE.md', SCOPED)).toEqual([])
    expect(lintMemory(RULE, dir, 'docs/a.md', SCOPED)).toEqual([])
  })

  it('makes no report in a tree with no .git, where the end of the repository is unknown', () => {
    expect(outside(SCOPED, { git: false })).toEqual([])
    const dir = tree({ 'docs/a.md': SCOPED }, false)
    link(dir, FILE, '../../docs/a.md')
    expect(lintMemory(RULE, dir, FILE, SCOPED)).toEqual([])
  })
})

describe.skipIf(noLinks)(`${RULE}: what the rule cannot read`, () => {
  it('makes no report for a link that leads nowhere', () => {
    const dir = tree({})
    link(dir, FILE, '/nowhere/a.md')
    link(dir, '.claude/rules/gone', '/nowhere')
    expect(lintMemory(RULE, dir, FILE, SCOPED)).toEqual([])
    expect(lintMemory(RULE, dir, '.claude/rules/gone/b.md', SCOPED)).toEqual([])
  })

  it('makes no report for a file that is not on disk', () => {
    expect(lintMemory(RULE, tree({}), FILE, SCOPED)).toEqual([])
  })

  it.skipIf(chmodCannotBlock)('makes no report for a path that it cannot read', () => {
    const dir = tree({ '.claude/rules/sub/b.md': SCOPED })
    withoutAccess(path.join(dir, '.claude/rules/sub'), () => {
      expect(lintMemory(RULE, dir, '.claude/rules/sub/b.md', SCOPED)).toEqual([])
    })
  })
})
