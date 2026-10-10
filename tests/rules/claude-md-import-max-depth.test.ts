// A chain of `@path` imports loads to a depth of four hops. The file at hop five and the files
// past it do not load (https://code.claude.com/docs/en/memory#import-additional-files). The rule
// follows the chain on disk from the linted file, and reports the import of that file that
// starts a chain which is too long. A path it cannot read ends the chain there: a path out of the
// repository, a dangling link and an unreadable file give no report. The globs are in
// tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, lintMemory, noLinks, tree } from '../memory-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'claude-md-import-max-depth'

/** The files `f1.md` to `f<n>.md`: each one imports the next, and the last one imports nothing. */
const chainOf = (n: number): Record<string, string> =>
  Object.fromEntries(
    Array.from({ length: n }, (_, i) => [`f${i + 1}.md`, i + 1 < n ? `@f${i + 2}.md\n` : 'end\n']),
  )

function lint(code: string, files: Record<string, string>, options?: object, file = 'CLAUDE.md') {
  return lintMemory(RULE, tree({ [file]: code, ...files }), file, code, options)
}

const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

describe(RULE, () => {
  it('reports the import that leads to a file at hop five, at the token', () => {
    const messages = lint('See @f1.md for more.\n', chainOf(5))
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'tooDeep',
      line: 1,
      column: 5,
      endLine: 1,
      endColumn: 11,
    })
    expect(messages[0]?.message).toBe(
      'This import leads to `f5.md` at hop 5. Claude Code loads imports to 4 hops only, so it does not load that file.',
    )
  })

  it('stays silent on a chain of four hops, the depth that loads', () => {
    expect(lint('@f1.md\n', chainOf(4))).toEqual([])
  })

  it('stays silent on a file with no import, and on an import of a file with none', () => {
    expect(lint('# Notes\n', {})).toEqual([])
    expect(lint('@f1.md\n', chainOf(1))).toEqual([])
  })

  it('counts a chain from the file that is linted, not from a file that imports it', () => {
    // `f1.md` is the root of its own chain of four hops.
    expect(lint('@f2.md\n', chainOf(6), undefined, 'AGENTS.md')).toHaveLength(1)
    expect(lint('@f3.md\n', chainOf(6), undefined, 'AGENTS.md')).toEqual([])
  })

  it('reports only the import of the root that leads to the deep file', () => {
    const files = { ...chainOf(5), 'short.md': 'short\n' }
    const messages = lint('@short.md\n@f1.md\n', files)
    expect(messages.map((m) => [m.line, m.column])).toEqual([[2, 1]])
  })

  it('reports each import of the root that leads to a deep file', () => {
    const files = {
      ...chainOf(4),
      'g1.md': '@g2.md\n',
      'g2.md': '@g3.md\n',
      'g3.md': '@g4.md\n',
      'g4.md': 'end\n',
    }
    expect(lint('@f1.md @g1.md\n', files, { max: 3 }).map((m) => m.column)).toEqual([1, 8])
  })

  it('resolves each import against the folder of the file that holds it', () => {
    const files = {
      'docs/a.md': '@b.md\n',
      'docs/b.md': '@../c.md\n',
      'c.md': '@docs/d.md\n',
      'docs/d.md': 'end\n',
    }
    // Hop 1 a.md, hop 2 b.md, hop 3 c.md, hop 4 d.md.
    expect(lint('@docs/a.md\n', files, { max: 3 })).toHaveLength(1)
    expect(lint('@docs/a.md\n', files, { max: 4 })).toEqual([])
  })
})

describe(`${RULE}: the option max`, () => {
  it('sets the depth, and names it as the configured limit', () => {
    const messages = lint('@f1.md\n', chainOf(3), { max: 2 })
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ messageId: 'overConfiguredLimit' })
    expect(messages[0]?.message).toBe(
      'This import leads to `f3.md` at hop 3. The configured limit is 2 hops.',
    )
    expect(lint('@f1.md\n', chainOf(2), { max: 2 })).toEqual([])
  })

  it('takes a depth of one', () => {
    expect(ids(lint('@f1.md\n', chainOf(2), { max: 1 }))).toEqual(['overConfiguredLimit'])
    expect(lint('@f1.md\n', chainOf(1), { max: 1 })).toEqual([])
  })

  it('reads the docs depth of four as the default, with the message of the docs', () => {
    expect(ids(lint('@f1.md\n', chainOf(5), { max: 4 }))).toEqual(['tooDeep'])
  })

  it('refuses a depth that is more than four, or less than one', () => {
    expect(() => lint('@f1.md\n', chainOf(5), { max: 5 })).toThrow(/should be <= 4/)
    expect(() => lint('@f1.md\n', chainOf(5), { max: 0 })).toThrow(/should be >= 1/)
    expect(() => lint('@f1.md\n', chainOf(5), { max: 1.5 })).toThrow(/should be integer/)
  })
})

describe(`${RULE}: a cycle`, () => {
  it('makes no report for files that import each other', () => {
    const files = { 'a.md': '@b.md\n', 'b.md': '@a.md @CLAUDE.md\n' }
    expect(lint('@a.md\n', files)).toEqual([])
    expect(lint('@a.md\n', files, { max: 1 })).toHaveLength(1)
  })

  it('loads a file at the fewest hops that reach it', () => {
    // `f4.md` is at hop 4 by `@f1.md`, and at hop 2 by `@f3.md`. It loads at hop 2.
    expect(lint('@f3.md\n@f1.md\n', chainOf(5))).toEqual([])
    expect(ids(lint('@f1.md\n', chainOf(5)))).toEqual(['tooDeep'])
  })

  it('reports a chain that goes on past a cycle', () => {
    const files = { 'a.md': '@b.md\n', 'b.md': '@a.md @c.md\n', 'c.md': '@d.md\n', 'd.md': 'end\n' }
    expect(ids(lint('@a.md\n', files, { max: 3 }))).toEqual(['overConfiguredLimit'])
  })
})

describe(`${RULE}: what the rule skips`, () => {
  it('does not follow an import in a code span, a fenced block or an HTML comment', () => {
    const files = { ...chainOf(5), 'f3.md': '`@f4.md` and\n```\n@f4.md\n```\n<!-- @f4.md -->\n' }
    expect(lint('@f1.md\n', files)).toEqual([])
  })

  it('does not follow a path that is missing, a folder or a path to the home folder', () => {
    const files = { ...chainOf(4), 'f4.md': '@missing.md @dir @~/x.md\n', 'dir/x.md': 'x\n' }
    expect(lint('@f1.md\n', files)).toEqual([])
  })

  it('does not check a file that Claude Code never reads', () => {
    expect(lint('@f1.md\n', chainOf(5), undefined, '.agents/AGENTS.md')).toEqual([])
  })

  it('reads a file that is not on disk as the root of the chain', () => {
    const dir = tree(chainOf(5))
    expect(ids(lintMemory(RULE, dir, 'CLAUDE.md', '@f1.md\n'))).toEqual(['tooDeep'])
  })

  it.skipIf(noLinks)('follows a link inside the repository, and not a link out of it', () => {
    const outside = tree({ 'o1.md': '@o2.md\n', 'o2.md': 'end\n' })
    const dir = tree({ ...chainOf(3), 'f3.md': '@in.md\n', 'real.md': '@out.md @gone.md\n' })
    link(dir, 'in.md', 'real.md')
    link(dir, 'out.md', path.join(outside, 'o1.md'))
    link(dir, 'gone.md', 'nowhere.md')
    // `f1` is hop 1, `f2` hop 2, `f3` hop 3, `real.md` hop 4, and the link out of the repository
    // ends the chain. A link that is dangling does so too.
    expect(lintMemory(RULE, dir, 'CLAUDE.md', '@f1.md\n')).toEqual([])
    expect(ids(lintMemory(RULE, dir, 'CLAUDE.md', '@f1.md\n', { max: 3 }))).toEqual([
      'overConfiguredLimit',
    ])
  })

  it.skipIf(chmodCannotBlock)('ends the chain at a file that it cannot read', () => {
    const dir = tree(chainOf(5))
    withoutAccess(path.join(dir, 'f3.md'), () => {
      expect(lintMemory(RULE, dir, 'CLAUDE.md', '@f1.md\n')).toEqual([])
    })
  })
})
