// By default Claude Code reads an `AGENTS.md` only when no `CLAUDE.md`, `.claude/CLAUDE.md` or
// `CLAUDE.local.md` exists in the working directory or above it. A CLAUDE.md file that imports
// the `AGENTS.md`, or links to it, loads it
// (https://code.claude.com/docs/en/memory#when-claude-code-reads-agents-md). The rule looks at
// the folder of the linted file and each folder above it, up to the repository root, so each
// case builds a tree on disk. A file that it cannot read, a dangling link and a link out of the
// repository give no report. The globs are in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, lintMemory, noLinks, tree } from '../memory-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'claude-md-agents-md-shadowed'

/** The messages for the file `file` of the tree `files`, which is a repository unless `git` is false. */
function lint(files: Record<string, string>, file = 'AGENTS.md', git = true) {
  const dir = tree({ [file]: '# Agents\n', ...files }, git)
  return lintMemory(RULE, dir, file, '# Agents\n')
}

const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

describe(RULE, () => {
  it('reports an AGENTS.md beside a CLAUDE.md that does not import it, at the start', () => {
    const messages = lint({ 'CLAUDE.md': '# Rules\n' })
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'shadowed',
      line: 1,
      column: 1,
    })
    expect(messages[0]?.message).toBe(
      'Claude Code does not read this file, because `CLAUDE.md` exists in this folder or above it. Import this file from a CLAUDE.md file with `@`, or delete that file.',
    )
  })

  it('reports for a .claude/CLAUDE.md and a CLAUDE.local.md, and names the file', () => {
    expect(lint({ '.claude/CLAUDE.md': '# Rules\n' })[0]?.message).toContain('`.claude/CLAUDE.md`')
    expect(lint({ 'CLAUDE.local.md': '# Rules\n' })[0]?.message).toContain('`CLAUDE.local.md`')
  })

  it('reports a .claude/AGENTS.md for a CLAUDE.md in the folder above .claude', () => {
    expect(ids(lint({ 'CLAUDE.md': '# Rules\n' }, '.claude/AGENTS.md'))).toEqual(['shadowed'])
    expect(ids(lint({ '.claude/CLAUDE.md': '# Rules\n' }, '.claude/AGENTS.md'))).toEqual([
      'shadowed',
    ])
  })

  it('reports for a CLAUDE.md in a folder above, up to the repository root', () => {
    expect(ids(lint({ 'CLAUDE.md': '# Rules\n' }, 'packages/web/AGENTS.md'))).toEqual(['shadowed'])
    expect(ids(lint({ 'packages/CLAUDE.local.md': 'x\n' }, 'packages/web/AGENTS.md'))).toEqual([
      'shadowed',
    ])
    expect(ids(lint({ 'packages/.claude/CLAUDE.md': 'x\n' }, 'packages/web/AGENTS.md'))).toEqual([
      'shadowed',
    ])
  })

  it('names the nearest file when two exist', () => {
    const files = { 'CLAUDE.md': 'x\n', 'packages/CLAUDE.md': 'x\n' }
    expect(lint(files, 'packages/web/AGENTS.md')[0]?.message).toContain('`packages/CLAUDE.md`')
  })

  it('stays silent on an AGENTS.md with no CLAUDE.md in its folder or above it', () => {
    expect(lint({})).toEqual([])
    expect(lint({ 'README.md': '# R\n' }, '.claude/AGENTS.md')).toEqual([])
  })

  it('stays silent when the CLAUDE.md is below or beside the folder, not above it', () => {
    expect(lint({ 'packages/web/CLAUDE.md': 'x\n' })).toEqual([])
    expect(lint({ 'packages/api/CLAUDE.md': 'x\n' }, 'packages/web/AGENTS.md')).toEqual([])
  })

  it('does not see a folder above the repository root', () => {
    const outer = tree(
      { 'CLAUDE.md': 'x\n', 'repo/.git/HEAD': '', 'repo/AGENTS.md': '# A\n' },
      false,
    )
    expect(lintMemory(RULE, outer, 'repo/AGENTS.md', '# A\n')).toEqual([])
    // The same trees with the CLAUDE.md inside the repository.
    const inner = tree(
      { 'repo/CLAUDE.md': 'x\n', 'repo/.git/HEAD': '', 'repo/AGENTS.md': '# A\n' },
      false,
    )
    expect(ids(lintMemory(RULE, inner, 'repo/AGENTS.md', '# A\n'))).toEqual(['shadowed'])
  })

  it('does not see a folder above a tree with no .git', () => {
    expect(lint({ 'CLAUDE.md': 'x\n' }, 'packages/web/AGENTS.md', false)).toEqual([])
    expect(ids(lint({ 'packages/web/CLAUDE.md': 'x\n' }, 'packages/web/AGENTS.md', false))).toEqual(
      ['shadowed'],
    )
  })

  it('reads a file that is not on disk as an AGENTS.md of its folder', () => {
    const dir = tree({ 'CLAUDE.md': 'x\n' })
    expect(ids(lintMemory(RULE, dir, 'AGENTS.md', '# Agents\n'))).toEqual(['shadowed'])
  })

  it('does not check a file that Claude Code does not read as AGENTS.md', () => {
    const files = { 'CLAUDE.md': 'x\n', '.claude/rules/CLAUDE.md': 'x\n' }
    expect(lint(files, '.claude/rules/AGENTS.md')).toEqual([])
    expect(lint(files, '.agents/AGENTS.md')).toEqual([])
    expect(lint(files, 'AGENTS.local.md')).toEqual([])
  })
})

describe(`${RULE}: the import that loads the file`, () => {
  it('stays silent when the CLAUDE.md imports the AGENTS.md', () => {
    expect(lint({ 'CLAUDE.md': '@AGENTS.md\n\n## Claude Code\n\nUse plan mode.\n' })).toEqual([])
    expect(lint({ 'CLAUDE.md': 'See @./AGENTS.md.\n' })).toEqual([])
    expect(lint({ 'CLAUDE.local.md': '@AGENTS.md\n' })).toEqual([])
  })

  it('resolves the path against the folder of the file that imports', () => {
    expect(lint({ '.claude/CLAUDE.md': '@../AGENTS.md\n' })).toEqual([])
    expect(ids(lint({ '.claude/CLAUDE.md': '@AGENTS.md\n' }))).toEqual(['shadowed'])
    expect(lint({ 'CLAUDE.md': '@packages/web/AGENTS.md\n' }, 'packages/web/AGENTS.md')).toEqual([])
    expect(lint({ '.claude/CLAUDE.md': '@AGENTS.md\n' }, '.claude/AGENTS.md')).toEqual([])
  })

  it('reports an AGENTS.md of another folder, which the CLAUDE.md does not import', () => {
    const files = { 'CLAUDE.md': '@AGENTS.md\n', 'AGENTS.md': '# Root\n' }
    expect(ids(lint(files, 'packages/web/AGENTS.md'))).toEqual(['shadowed'])
  })

  it('follows an import through other files, to the depth of four hops', () => {
    const chain = (n: number) => ({
      'CLAUDE.md': '@f1.md\n',
      ...Object.fromEntries(
        Array.from({ length: n }, (_, i) => [
          `f${i + 1}.md`,
          i + 1 < n ? `@f${i + 2}.md\n` : '@AGENTS.md\n',
        ]),
      ),
    })
    // The AGENTS.md is at hop 4 when `f3.md` imports it, and at hop 5 when `f4.md` does.
    expect(lint(chain(3))).toEqual([])
    expect(ids(lint(chain(4)))).toEqual(['shadowed'])
  })

  it('stays silent when one of two CLAUDE.md files imports the AGENTS.md', () => {
    expect(lint({ 'CLAUDE.md': '# Other\n', 'CLAUDE.local.md': '@AGENTS.md\n' })).toEqual([])
    expect(lint({ 'CLAUDE.md': '@AGENTS.md\n', 'CLAUDE.local.md': '# Other\n' })).toEqual([])
  })

  it('does not count an import in a code span, a fenced block or an HTML comment', () => {
    const text = 'Write `@AGENTS.md`.\n\n```\n@AGENTS.md\n```\n\n<!-- @AGENTS.md -->\n'
    expect(ids(lint({ 'CLAUDE.md': text }))).toEqual(['shadowed'])
  })

  it('does not count a prose pointer, or an import of a file with the same name elsewhere', () => {
    expect(ids(lint({ 'CLAUDE.md': 'Read AGENTS.md first.\n' }))).toEqual(['shadowed'])
    expect(ids(lint({ 'CLAUDE.md': '@docs/AGENTS.md\n', 'docs/AGENTS.md': 'x\n' }))).toEqual([
      'shadowed',
    ])
  })

  it.skipIf(noLinks)('stays silent when the CLAUDE.md is a link to the AGENTS.md', () => {
    const dir = tree({ 'AGENTS.md': '# Agents\n' })
    link(dir, 'CLAUDE.md', 'AGENTS.md')
    expect(lintMemory(RULE, dir, 'AGENTS.md', '# Agents\n')).toEqual([])
    const nested = tree({ 'packages/web/AGENTS.md': '# Agents\n' })
    link(nested, 'packages/web/CLAUDE.md', '../../packages/web/AGENTS.md')
    expect(lintMemory(RULE, nested, 'packages/web/AGENTS.md', '# Agents\n')).toEqual([])
  })

  it.skipIf(noLinks)('reports a CLAUDE.md that is a link to another file', () => {
    const dir = tree({ 'AGENTS.md': '# Agents\n', 'OTHER.md': 'x\n' })
    link(dir, 'CLAUDE.md', 'OTHER.md')
    expect(ids(lintMemory(RULE, dir, 'AGENTS.md', '# Agents\n'))).toEqual(['shadowed'])
  })
})

describe(`${RULE}: what the rule cannot read`, () => {
  it('does not count a CLAUDE.md that is a folder', () => {
    expect(lint({ 'CLAUDE.md/x.md': 'x\n' })).toEqual([])
  })

  it.skipIf(noLinks)(
    'makes no report for a CLAUDE.md that is a dangling link or a link out of the repository',
    () => {
      const outside = tree({ 'x.md': '@AGENTS.md\n' })
      const dir = tree({ 'AGENTS.md': '# Agents\n' })
      link(dir, 'CLAUDE.md', 'nowhere.md')
      expect(lintMemory(RULE, dir, 'AGENTS.md', '# Agents\n')).toEqual([])
      const other = tree({ 'AGENTS.md': '# Agents\n' })
      link(other, 'CLAUDE.md', path.join(outside, 'x.md'))
      expect(lintMemory(RULE, other, 'AGENTS.md', '# Agents\n')).toEqual([])
    },
  )

  it.skipIf(noLinks)('makes no report when the AGENTS.md is a link out of the repository', () => {
    const outside = tree({ 'AGENTS.md': '# Agents\n' })
    const dir = tree({ 'CLAUDE.md': 'x\n' })
    link(dir, 'AGENTS.md', path.join(outside, 'AGENTS.md'))
    expect(lintMemory(RULE, dir, 'AGENTS.md', '# Agents\n')).toEqual([])
  })

  it.skipIf(chmodCannotBlock)('makes no report for a CLAUDE.md that it cannot read', () => {
    const dir = tree({ 'AGENTS.md': '# Agents\n', 'CLAUDE.md': 'x\n' })
    withoutAccess(path.join(dir, 'CLAUDE.md'), () => {
      expect(lintMemory(RULE, dir, 'AGENTS.md', '# Agents\n')).toEqual([])
    })
  })

  it.skipIf(chmodCannotBlock)('makes no report when an imported file cannot be read', () => {
    const dir = tree({ 'AGENTS.md': '# Agents\n', 'CLAUDE.md': '@a.md\n', 'a.md': '@AGENTS.md\n' })
    withoutAccess(path.join(dir, 'a.md'), () => {
      expect(lintMemory(RULE, dir, 'AGENTS.md', '# Agents\n')).toEqual([])
    })
  })

  it.skipIf(chmodCannotBlock)('makes no report for a folder that it cannot read', () => {
    const dir = tree({ 'packages/web/AGENTS.md': '# Agents\n', 'packages/CLAUDE.md': 'x\n' })
    withoutAccess(path.join(dir, 'packages'), () => {
      expect(lintMemory(RULE, dir, 'packages/web/AGENTS.md', '# Agents\n')).toEqual([])
    })
  })

  it('makes no report for a file in a folder that is not there', () => {
    const dir = tree({ 'CLAUDE.md': 'x\n' })
    expect(lintMemory(RULE, dir, 'none/AGENTS.md', '# Agents\n')).toEqual([])
  })

  it('ignores an import of a missing file or of the home folder', () => {
    expect(
      ids(lint({ 'CLAUDE.md': '@missing.md @~/AGENTS.md @dir\n', 'dir/x.md': 'x\n' })),
    ).toEqual(['shadowed'])
  })

  it('makes no report when an import leads out of the repository, where the chain is unknown', () => {
    expect(lint({ 'CLAUDE.md': '@../AGENTS.md\n' })).toEqual([])
  })
})
