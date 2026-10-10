// Claude Code warns when instruction files that are each within the recommended length add up
// past a combined limit at session start. Each CLAUDE.md, rules file and `@path` import counts
// as a separate file (https://code.claude.com/docs/en/memory#my-claude-md-is-too-large). The
// docs give no number, so the rule has the option `max` and no default. The rule reads the
// repository around the file, so each case builds a tree on disk. It makes no report that rests
// on a file that it cannot read. The globs are in tests/configs.test.ts.
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
  max: number | undefined = 50,
  file = 'CLAUDE.md',
) {
  return lintMemory(RULE, tree(files), file, code, max === undefined ? undefined : { max })
}

const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

describe(RULE, () => {
  it.fails('makes no report when no max is set, however many lines the files hold', () => {
    const files = { 'CLAUDE.local.md': lines(5000), '.claude/rules/a.md': lines(5000) }
    expect(lint(lines(5000), files, undefined)).toEqual([])
    expect(lintMemory(RULE, tree(files), 'CLAUDE.md', lines(5000), {})).toEqual([])
  })

  it.fails('reports a set over max, once, at the start of the file', () => {
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

  it.fails('stays silent on a set at max, and on a set under it', () => {
    expect(lint(lines(30), { 'CLAUDE.local.md': lines(20) })).toEqual([])
    expect(lint(lines(30), { 'CLAUDE.local.md': lines(19) })).toEqual([])
    expect(lint(lines(60), {}, 60)).toEqual([])
    expect(ids(lint(lines(61), {}, 60))).toEqual(['tooLong'])
  })

  it.fails('counts the text that is linted, not the text on disk', () => {
    expect(ids(lint(lines(60), { 'CLAUDE.md': lines(1) }))).toEqual(['tooLong'])
    expect(lint(lines(1), { 'CLAUDE.md': lines(60) })).toEqual([])
  })

  it.fails('accepts an integer from 1 up and nothing else', () => {
    expect(() => lint('x\n', {}, 1)).not.toThrow()
    expect(() => lint('x\n', {}, 0)).toThrow()
    expect(() => lint('x\n', {}, 1.5)).toThrow()
    expect(() => lintMemory(RULE, tree({}), 'CLAUDE.md', 'x\n', { min: 1 })).toThrow()
  })
})

describe(`${RULE}: which file reports`, () => {
  it.fails('checks a CLAUDE.md, a .claude/CLAUDE.md and a CLAUDE.local.md', () => {
    for (const file of ['CLAUDE.md', '.claude/CLAUDE.md', 'CLAUDE.local.md']) {
      expect(ids(lint(lines(60), {}, 50, file)), file).toEqual(['tooLong'])
    }
  })

  it.fails('does not check a file that Claude Code does not load as a memory file', () => {
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

  it.fails('reports in one file of a folder that holds two, the first of the three names', () => {
    const files = { 'CLAUDE.md': lines(30), '.claude/CLAUDE.md': lines(30) }
    expect(ids(lint(lines(30), files, 50, 'CLAUDE.md'))).toEqual(['tooLong'])
    expect(lint(lines(30), files, 50, '.claude/CLAUDE.md')).toEqual([])
    expect(lint(lines(30), { 'CLAUDE.md': lines(30) }, 50, 'CLAUDE.local.md')).toEqual([])
    const local = { '.claude/CLAUDE.md': lines(30) }
    expect(ids(lint(lines(30), local, 50, '.claude/CLAUDE.md'))).toEqual(['tooLong'])
    expect(lint(lines(30), local, 50, 'CLAUDE.local.md')).toEqual([])
  })

  it.fails('reports a file that is not on disk, as the first of its folder', () => {
    expect(ids(lint(lines(60), {}, 50, 'CLAUDE.local.md'))).toEqual(['tooLong'])
  })
})

describe(`${RULE}: the folders above`, () => {
  const files = { 'CLAUDE.md': lines(40), 'packages/a/CLAUDE.md': lines(20) }

  it.fails('adds the files of each folder above, up to the repository root', () => {
    expect(lint(lines(40), files, 50, 'CLAUDE.md')).toEqual([])
    expect(ids(lint(lines(20), files, 50, 'packages/a/CLAUDE.md'))).toEqual(['tooLong'])
    const deep = { ...files, 'packages/CLAUDE.local.md': lines(5) }
    expect(ids(lint(lines(1), deep, 50, 'packages/a/b/CLAUDE.md'))).toEqual(['tooLong'])
  })

  it.fails('reports at the first folder that passes max, and not in the folders below it', () => {
    const over = { 'CLAUDE.md': lines(60), 'packages/a/CLAUDE.md': lines(20) }
    expect(ids(lint(lines(60), over, 50, 'CLAUDE.md'))).toEqual(['tooLong'])
    expect(lint(lines(20), over, 50, 'packages/a/CLAUDE.md')).toEqual([])
  })

  it.fails('does not read a folder above the repository root', () => {
    const dir = tree({ 'CLAUDE.md': lines(60), 'inner/.git/HEAD': 'ref\n', 'inner/x.md': 'x\n' })
    expect(lintMemory(RULE, dir, 'inner/CLAUDE.md', lines(10), { max: 50 })).toEqual([])
  })

  it.fails('reads only its own folder where no .git is above', () => {
    const dir = tree({ 'CLAUDE.md': lines(60), 'sub/CLAUDE.local.md': lines(30) }, false)
    expect(lintMemory(RULE, dir, 'sub/CLAUDE.md', lines(30), { max: 50 })).toHaveLength(1)
    expect(lintMemory(RULE, dir, 'sub/CLAUDE.md', lines(10), { max: 50 })).toEqual([])
  })
})

describe(`${RULE}: the rules`, () => {
  it.fails('adds a rule file that has no paths, at any depth, and skips a scoped one', () => {
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

  it.fails('counts a rule with an empty paths field or a frontmatter that does not parse', () => {
    const empty = { '.claude/rules/a.md': `---\npaths: ""\n---\n${lines(60)}` }
    expect(ids(lint('x\n', empty))).toEqual(['tooLong'])
    const bad = { '.claude/rules/a.md': `---\npaths: [\n---\n${lines(60)}` }
    expect(ids(lint('x\n', bad))).toEqual(['tooLong'])
    expect(ids(lint('x\n', { '.claude/rules/a.md': `# R\n${lines(60)}` }))).toEqual(['tooLong'])
  })

  it.fails('adds the rules of a folder above', () => {
    const files = { '.claude/rules/a.md': lines(40), 'packages/a/.claude/rules/b.md': lines(20) }
    expect(lint(lines(1), files, 50, 'CLAUDE.md')).toEqual([])
    expect(ids(lint(lines(1), files, 50, 'packages/a/CLAUDE.md'))).toEqual(['tooLong'])
  })

  it.fails('adds the imports of a rule file', () => {
    const files = { '.claude/rules/a.md': '@../../docs/big.md\n', 'docs/big.md': lines(60) }
    expect(ids(lint('x\n', files))).toEqual(['tooLong'])
  })
})

describe(`${RULE}: the imports`, () => {
  it.fails('adds the lines of an imported file, and of its imports to four hops', () => {
    const files = {
      'a.md': `${lines(10)}@b.md\n`,
      'b.md': `${lines(10)}@c.md\n`,
      'c.md': `${lines(10)}@d.md\n`,
      'd.md': `${lines(10)}@e.md\n`,
      'e.md': lines(100),
    }
    // The root has 1 line, `a` to `d` have 11 lines each, and `e` is at the fifth hop.
    expect(ids(lint('@a.md\n', files, 45))).toEqual(['tooLong'])
    expect(lint('@a.md\n', files, 45 + 1)).toEqual([])
    expect(lint('@a.md\n', files, 1000)).toEqual([])
  })

  it.fails('counts a file once, however many ways it loads', () => {
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

  it.fails('ends a cycle where the chain meets a file again', () => {
    const files = { 'a.md': `@CLAUDE.md\n${lines(60)}` }
    expect(ids(lint('@a.md\n', files))).toEqual(['tooLong'])
  })

  it.fails('adds a file that an import of a CLAUDE.local.md loads', () => {
    const files = { 'CLAUDE.local.md': '@more.md\n', 'more.md': lines(60) }
    expect(ids(lint('x\n', files))).toEqual(['tooLong'])
  })

  it.fails('does not add an import in a code span or a folder, or an import that is not there', () => {
    const files = { 'big.md': lines(60), 'dir/x.md': lines(60) }
    expect(lint('`@big.md` @none.md @dir\n', files)).toEqual([])
  })
})

describe(`${RULE}: what the rule cannot read`, () => {
  it.fails('makes no report when an import leaves the repository', () => {
    const files = { 'CLAUDE.local.md': lines(60) }
    expect(ids(lint('x\n', files))).toEqual(['tooLong'])
    expect(lint('x\n@../outside.md\n', files)).toEqual([])
    expect(lint('x\n@~/mine.md\n', files)).toEqual([])
  })

  it.skipIf(noLinks).fails('makes no report when an import is a dangling link', () => {
    const dir = tree({ 'CLAUDE.local.md': lines(60) })
    link(dir, 'gone.md', 'nowhere.md')
    expect(lintMemory(RULE, dir, 'CLAUDE.md', 'x\n@gone.md\n', { max: 50 })).toEqual([])
    expect(ids(lintMemory(RULE, dir, 'CLAUDE.md', 'x\n', { max: 50 }))).toEqual(['tooLong'])
  })

  it.skipIf(noLinks).fails('makes no report when a CLAUDE.md of a folder is a link out', () => {
    const dir = tree({ 'sub/CLAUDE.local.md': lines(60) })
    link(dir, 'CLAUDE.md', path.join(tree({ 'file.md': lines(5) }), 'file.md'))
    expect(lintMemory(RULE, dir, 'sub/CLAUDE.md', 'x\n', { max: 50 })).toEqual([])
  })

  it.skipIf(noLinks).fails('makes no report when a rule folder is a link out', () => {
    const dir = tree({ 'CLAUDE.local.md': lines(60) })
    link(dir, '.claude/rules', tree({ 'a.md': lines(5) }))
    expect(lintMemory(RULE, dir, 'CLAUDE.md', 'x\n', { max: 50 })).toEqual([])
  })

  it.skipIf(chmodCannotBlock).fails('makes no report when a file has no read right', () => {
    const dir = tree({ 'CLAUDE.local.md': lines(60), 'more.md': lines(5) })
    const file = path.join(dir, 'more.md')
    withoutAccess(file, () => {
      expect(lintMemory(RULE, dir, 'CLAUDE.md', 'x\n@more.md\n', { max: 50 })).toEqual([])
    })
    const rule = { '.claude/rules/a.md': lines(5), 'CLAUDE.local.md': lines(60) }
    const ruleDir = tree(rule)
    withoutAccess(path.join(ruleDir, '.claude/rules/a.md'), () => {
      expect(lintMemory(RULE, ruleDir, 'CLAUDE.md', 'x\n', { max: 50 })).toEqual([])
    })
  })

  it.fails('reads a directory named like an instruction file as no file', () => {
    const dir = tree({ 'CLAUDE.local.md/x.md': 'x\n', 'more/x.md': 'x\n' })
    expect(lintMemory(RULE, dir, 'CLAUDE.md', lines(60), { max: 50 })).toHaveLength(1)
  })
})
