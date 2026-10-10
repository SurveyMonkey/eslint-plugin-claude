// Claude Code warns when instruction files that are each within the recommended length add up
// past a combined limit at session start. Each CLAUDE.md, rules file and `@path` import counts
// as a separate file (https://code.claude.com/docs/en/memory#my-claude-md-is-too-large). The
// docs give no number, so the rule has the option `max` and no default. The rule reads the
// repository around the file, so each case builds a tree on disk. A part that the rule
// cannot read adds nothing. The rule reports when the lines that it read pass max. The globs
// are in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, lintMemory, noLinks, tree } from '../memory-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'claude-md-combined-size'

/** A text of `count` lines, each ended by a newline. */
const lines = (count: number) => 'x\n'.repeat(count)

/** The messages for `code` as the file `file` of the tree `files`, at the option `max`. */
function lint(
  code: string,
  files: Record<string, string> = {},
  max: number | null = 50,
  file = 'CLAUDE.md',
) {
  return lintMemory(RULE, tree(files), file, code, max === null ? undefined : { max })
}

const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

describe(RULE, () => {
  it('makes no report when no max is set, however many lines the files hold', () => {
    const files = { 'CLAUDE.local.md': lines(5000), '.claude/rules/a.md': lines(5000) }
    expect(lint(lines(5000), files, null)).toEqual([])
    expect(lintMemory(RULE, tree(files), 'CLAUDE.md', lines(5000), {})).toEqual([])
  })

  it('reports a set over max, once, at the start of the file', () => {
    const messages = lint(lines(30), { 'CLAUDE.local.md': lines(30) })
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'tooLong',
      line: 1,
      column: 1,
    })
    expect(messages[0]?.message).toBe(
      'The files that load at launch with this file have 60 lines. The configured limit is 50 lines. Claude Code warns when instruction files add up past a combined limit. Move instructions into path-scoped rules.',
    )
  })

  it('stays silent on a set at max, and on a set under it', () => {
    expect(lint(lines(30), { 'CLAUDE.local.md': lines(20) })).toEqual([])
    expect(lint(lines(30), { 'CLAUDE.local.md': lines(19) })).toEqual([])
    expect(lint(lines(60), {}, 60)).toEqual([])
    expect(ids(lint(lines(61), {}, 60))).toEqual(['tooLong'])
  })

  it('counts the text that is linted, not the text on disk', () => {
    expect(ids(lint(lines(60), { 'CLAUDE.md': lines(1) }))).toEqual(['tooLong'])
    expect(lint(lines(1), { 'CLAUDE.md': lines(60) })).toEqual([])
  })

  it('accepts an integer from 1 up and nothing else', () => {
    expect(() => lint('x\n', {}, 1)).not.toThrow()
    expect(() => lint('x\n', {}, 0)).toThrow()
    expect(() => lint('x\n', {}, 1.5)).toThrow()
    expect(() => lintMemory(RULE, tree({}), 'CLAUDE.md', 'x\n', { min: 1 })).toThrow()
  })
})

describe(`${RULE}: which file reports`, () => {
  it('checks a CLAUDE.md, a .claude/CLAUDE.md and a CLAUDE.local.md', () => {
    for (const file of ['CLAUDE.md', '.claude/CLAUDE.md', 'CLAUDE.local.md']) {
      expect(ids(lint(lines(60), {}, 50, file)), file).toEqual(['tooLong'])
    }
  })

  it('does not check a file that Claude Code does not load as a memory file', () => {
    for (const file of [
      '.claude/rules/CLAUDE.md',
      '.claude/rules/long.md',
      'AGENTS.md',
      'docs/notes.md',
      'claude.md',
    ]) {
      expect(lint(lines(60), {}, 50, file), file).toEqual([])
    }
  })

  it('reports in one file of a folder that holds two, the first of the three names', () => {
    const files = { 'CLAUDE.md': lines(30), '.claude/CLAUDE.md': lines(30) }
    expect(ids(lint(lines(30), files, 50, 'CLAUDE.md'))).toEqual(['tooLong'])
    expect(lint(lines(30), files, 50, '.claude/CLAUDE.md')).toEqual([])
    expect(lint(lines(30), { 'CLAUDE.md': lines(30) }, 50, 'CLAUDE.local.md')).toEqual([])
    const local = { '.claude/CLAUDE.md': lines(30), 'CLAUDE.local.md': lines(30) }
    expect(ids(lint(lines(30), local, 50, '.claude/CLAUDE.md'))).toEqual(['tooLong'])
    expect(lint(lines(30), local, 50, 'CLAUDE.local.md')).toEqual([])
  })

  it('reports a file that is not on disk, as the first of its folder', () => {
    expect(ids(lint(lines(60), {}, 50, 'CLAUDE.local.md'))).toEqual(['tooLong'])
  })
})

describe(`${RULE}: the folders above`, () => {
  const files = { 'CLAUDE.md': lines(40), 'packages/a/CLAUDE.md': lines(20) }

  it('adds the files of each folder above, up to the repository root', () => {
    expect(lint(lines(40), files, 50, 'CLAUDE.md')).toEqual([])
    expect(ids(lint(lines(20), files, 50, 'packages/a/CLAUDE.md'))).toEqual(['tooLong'])
    const deep = {
      'CLAUDE.md': lines(20),
      'packages/CLAUDE.local.md': lines(20),
      'packages/a/CLAUDE.md': lines(5),
    }
    expect(ids(lint(lines(10), deep, 50, 'packages/a/b/CLAUDE.md'))).toEqual(['tooLong'])
    expect(lint(lines(5), deep, 50, 'packages/a/b/CLAUDE.md')).toEqual([])
  })

  it('reports at the first folder that passes max, and not in the folders below it', () => {
    const over = { 'CLAUDE.md': lines(60), 'packages/a/CLAUDE.md': lines(20) }
    expect(ids(lint(lines(60), over, 50, 'CLAUDE.md'))).toEqual(['tooLong'])
    expect(lint(lines(20), over, 50, 'packages/a/CLAUDE.md')).toEqual([])
  })

  it('does not report in the folder above when the sum reaches max only in the folder below', () => {
    const exact = { 'CLAUDE.md': lines(50), 'packages/a/CLAUDE.md': lines(10) }
    expect(lint(lines(50), exact, 50, 'CLAUDE.md')).toEqual([])
    expect(ids(lint(lines(10), exact, 50, 'packages/a/CLAUDE.md'))).toEqual(['tooLong'])
  })

  it('does not read a folder above the repository root', () => {
    const dir = tree({ 'CLAUDE.md': lines(60), 'inner/.git/HEAD': 'ref\n', 'inner/x.md': 'x\n' })
    expect(lintMemory(RULE, dir, 'inner/CLAUDE.md', lines(10), { max: 50 })).toEqual([])
  })

  it('reads only its own folder where no .git is above', () => {
    const dir = tree({ 'CLAUDE.md': lines(60), 'sub/CLAUDE.local.md': lines(30) }, false)
    expect(lintMemory(RULE, dir, 'sub/CLAUDE.md', lines(30), { max: 50 })).toHaveLength(1)
    expect(lintMemory(RULE, dir, 'sub/CLAUDE.md', lines(10), { max: 50 })).toEqual([])
  })
})

describe(`${RULE}: the rules`, () => {
  it('adds a rule file that has no paths, at any depth, and skips a scoped one', () => {
    const files = {
      '.claude/rules/always.md': lines(20),
      '.claude/rules/sub/deep.md': lines(20),
      '.claude/rules/scoped.md': `---\npaths:\n  - "src/**"\n---\n${lines(500)}`,
      '.claude/rules/string.md': `---\npaths: "src/**"\n---\n${lines(500)}`,
    }
    expect(ids(lint(lines(20), files))).toEqual(['tooLong'])
    expect(lint(lines(5), { '.claude/rules/scoped.md': files['.claude/rules/scoped.md'] })).toEqual(
      [],
    )
  })

  it('counts a rule with an empty paths field or a frontmatter that does not parse', () => {
    const empty = { '.claude/rules/a.md': `---\npaths: ""\n---\n${lines(60)}` }
    expect(ids(lint('x\n', empty))).toEqual(['tooLong'])
    const bad = { '.claude/rules/a.md': `---\npaths: [\n---\n${lines(60)}` }
    expect(ids(lint('x\n', bad))).toEqual(['tooLong'])
    expect(ids(lint('x\n', { '.claude/rules/a.md': `# R\n${lines(60)}` }))).toEqual(['tooLong'])
  })

  it('adds the rules of a folder above', () => {
    const files = { '.claude/rules/a.md': lines(40), 'packages/a/.claude/rules/b.md': lines(20) }
    expect(lint(lines(1), files, 50, 'CLAUDE.md')).toEqual([])
    expect(ids(lint(lines(1), files, 50, 'packages/a/CLAUDE.md'))).toEqual(['tooLong'])
  })

  it('adds the imports of a rule file', () => {
    const files = { '.claude/rules/a.md': '@../../docs/big.md\n', 'docs/big.md': lines(60) }
    expect(ids(lint('x\n', files))).toEqual(['tooLong'])
  })
})

describe(`${RULE}: the imports`, () => {
  it('adds the lines of an imported file, and of its imports to four hops', () => {
    const files = {
      'a.md': `${lines(10)}@b.md\n`,
      'b.md': `${lines(10)}@c.md\n`,
      'c.md': `${lines(10)}@d.md\n`,
      'd.md': `${lines(10)}@e.md\n`,
      'e.md': lines(100),
    }
    // The root has 1 line, `a` to `d` have 11 lines each, and `e` is at the fifth hop.
    expect(ids(lint('@a.md\n', files, 44))).toEqual(['tooLong'])
    expect(lint('@a.md\n', files, 45)).toEqual([])
  })

  it('counts a file once, however many ways it loads', () => {
    const files = {
      'a.md': '@shared.md\n',
      'b.md': '@shared.md\n',
      'shared.md': lines(40),
      'CLAUDE.local.md': '@shared.md\n',
    }
    // 1 (root) + 1 + 1 + 40 + 1: `shared.md` counts once.
    expect(lint('@a.md @b.md @shared.md\n', files, 44)).toEqual([])
    expect(ids(lint('@a.md @b.md @shared.md\n', files, 43))).toEqual(['tooLong'])
  })

  it('ends a cycle where the chain meets a file again', () => {
    const files = { 'CLAUDE.md': '@a.md\n', 'a.md': `@CLAUDE.md\n${lines(60)}` }
    const messages = lint('@a.md\n', files)
    expect(ids(messages)).toEqual(['tooLong'])
    expect(messages[0]?.message).toContain('have 62 lines')
  })

  it('counts a file once when it is a memory file and an import', () => {
    const files = { 'CLAUDE.local.md': lines(40) }
    expect(lint('@CLAUDE.local.md\n', files)).toEqual([])
    const back = {
      'CLAUDE.local.md': `@CLAUDE.md\n${lines(40)}`,
      'CLAUDE.md': '@CLAUDE.local.md\n',
    }
    expect(lint('@CLAUDE.local.md\n', back)).toEqual([])
  })

  it('adds a file that an import of a CLAUDE.local.md loads', () => {
    const files = { 'CLAUDE.local.md': '@more.md\n', 'more.md': lines(60) }
    expect(ids(lint('x\n', files))).toEqual(['tooLong'])
  })

  it('does not add an import in a code span or a folder, or an import that is not there', () => {
    const files = { 'big.md': lines(60), 'dir/x.md': lines(60) }
    expect(lint('`@big.md` @none.md @dir\n', files)).toEqual([])
  })
})

describe(`${RULE}: what the rule cannot read`, () => {
  // A part that the rule cannot read adds nothing, and the sum only grows. So the rule reports
  // when the lines that it read pass max, with "at least", and stays silent when they do not.
  const AT_LEAST = 'have at least 62 lines'
  const message = (messages: { message: string }[]) => messages.map((m) => m.message)

  it('reports with "at least" when an import leaves the repository and the rest is over max', () => {
    const files = { 'CLAUDE.local.md': lines(60) }
    expect(ids(lint('x\n', files))).toEqual(['tooLong'])
    const out = lint('x\n@../outside.md\n', files)
    expect(ids(out)).toEqual(['tooLong'])
    expect(message(out)[0]).toContain('have at least 62 lines')
    expect(ids(lint('x\n@~/mine.md\n', files))).toEqual(['tooLong'])
    expect(lint('x\n@../outside.md\n@~/mine.md\n', { 'CLAUDE.local.md': lines(5) })).toEqual([])
  })

  it.skipIf(noLinks)('reports on the lines it read when an import is a dangling link', () => {
    const dir = tree({ 'CLAUDE.local.md': lines(60) })
    link(dir, 'gone.md', 'nowhere.md')
    const out = lintMemory(RULE, dir, 'CLAUDE.md', 'x\n@gone.md\n', { max: 50 })
    expect(ids(out)).toEqual(['tooLong'])
    expect(message(out)[0]).toContain(AT_LEAST)
    expect(ids(lintMemory(RULE, dir, 'CLAUDE.md', 'x\n', { max: 50 }))).toEqual(['tooLong'])
    const small = tree({ 'CLAUDE.local.md': lines(5) })
    link(small, 'gone.md', 'nowhere.md')
    expect(lintMemory(RULE, small, 'CLAUDE.md', 'x\n@gone.md\n', { max: 50 })).toEqual([])
  })

  it.skipIf(noLinks)('counts an unscoped rule file after an unreadable import', () => {
    const dir = tree({ '.claude/rules/a.md': lines(60) })
    link(dir, 'gone.md', 'nowhere.md')
    const out = lintMemory(RULE, dir, 'CLAUDE.md', 'x\n@gone.md\n', { max: 50 })
    expect(ids(out)).toEqual(['tooLong'])
    expect(message(out)[0]).toContain(AT_LEAST)
  })

  it.skipIf(noLinks)(
    'reports when a CLAUDE.md of a folder is a link out and the rest is over max',
    () => {
      const dir = tree({ 'sub/CLAUDE.local.md': lines(60) })
      link(dir, 'CLAUDE.md', path.join(tree({ 'file.md': lines(5) }), 'file.md'))
      expect(ids(lintMemory(RULE, dir, 'sub/CLAUDE.md', 'x\n', { max: 50 }))).toEqual(['tooLong'])
      const small = tree({ 'sub/CLAUDE.local.md': lines(5) })
      link(small, 'CLAUDE.md', path.join(tree({ 'file.md': lines(5) }), 'file.md'))
      expect(lintMemory(RULE, small, 'sub/CLAUDE.md', 'x\n', { max: 50 })).toEqual([])
    },
  )

  it.skipIf(noLinks)('lets the next readable file report when the first one is a link out', () => {
    const dir = tree({ 'CLAUDE.local.md': lines(60) })
    link(dir, 'CLAUDE.md', path.join(tree({ 'file.md': lines(5) }), 'file.md'))
    const out = lintMemory(RULE, dir, '.claude/CLAUDE.md', 'x\n', { max: 50 })
    expect(ids(out)).toEqual(['tooLong'])
  })

  it.skipIf(noLinks)('reports when a rule folder is a link out and the rest is over max', () => {
    const dir = tree({ 'CLAUDE.local.md': lines(60) })
    link(dir, '.claude/rules', tree({ 'a.md': lines(5) }))
    expect(ids(lintMemory(RULE, dir, 'CLAUDE.md', 'x\n', { max: 50 }))).toEqual(['tooLong'])
    const small = tree({ 'CLAUDE.local.md': lines(5) })
    link(small, '.claude/rules', tree({ 'a.md': lines(5) }))
    expect(lintMemory(RULE, small, 'CLAUDE.md', 'x\n', { max: 50 })).toEqual([])
  })

  it.skipIf(chmodCannotBlock)('reports on the lines it read when a file has no read right', () => {
    const dir = tree({ 'CLAUDE.local.md': lines(60), 'more.md': lines(5) })
    const file = path.join(dir, 'more.md')
    withoutAccess(file, () => {
      expect(ids(lintMemory(RULE, dir, 'CLAUDE.md', 'x\n@more.md\n', { max: 50 }))).toEqual([
        'tooLong',
      ])
    })
    const rule = { '.claude/rules/a.md': lines(5), 'CLAUDE.local.md': lines(5) }
    const ruleDir = tree(rule)
    withoutAccess(path.join(ruleDir, '.claude/rules/a.md'), () => {
      expect(lintMemory(RULE, ruleDir, 'CLAUDE.md', 'x\n', { max: 50 })).toEqual([])
    })
  })

  it('reads a directory named like an instruction file as no file', () => {
    const dir = tree({ 'CLAUDE.local.md/x.md': 'x\n', 'more/x.md': 'x\n' })
    expect(lintMemory(RULE, dir, 'CLAUDE.md', lines(60), { max: 50 })).toHaveLength(1)
  })
})
