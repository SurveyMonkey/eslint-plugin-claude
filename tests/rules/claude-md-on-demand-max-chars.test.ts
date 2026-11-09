// When a subdirectory CLAUDE.md or a rules file that loads on demand is over a per-file size
// limit, Claude gets only the start of it. The limit is 40,000 characters for a 200K context
// window, as `wc -m` counts them
// (https://code.claude.com/docs/en/memory#claude-ignores-the-end-of-my-subdirectory-claude-md).
// The rule finds the start folder from the git top, so each case builds a tree on disk. The
// globs are in tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { lintMemory, tree } from '../memory-tree.test-support.ts'

const RULE = 'claude-md-on-demand-max-chars'

/** A text of `count` characters, each one byte. */
const chars = (count: number) => 'x'.repeat(count)

/** The messages for `code` as the file `file` of the tree `files`, at the default `max`. */
function lint(file: string, code: string, files: Record<string, string> = {}, git = true) {
  return lintMemory(RULE, tree(files, git), file, code)
}

const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

const SCOPED = '---\npaths:\n  - "src/**/*.ts"\n---\n'

describe(RULE, () => {
  it('reports a subfolder CLAUDE.md of 40,001 characters, once, at the start of the file', () => {
    const messages = lint('pkg/CLAUDE.md', chars(40001))
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'tooLong',
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 2,
    })
    expect(messages[0]?.message).toBe(
      'This file loads on demand and has 40001 characters. Claude gets only the start of an on-demand file of more than 40000 characters. Trim the file, or move part of it into rules files.',
    )
  })

  it('stays silent on a subfolder CLAUDE.md of exactly 40,000 characters', () => {
    expect(lint('pkg/CLAUDE.md', chars(40000))).toEqual([])
  })

  it('counts characters as wc -m does, not bytes and not UTF-16 units', () => {
    // 40,000 characters of two bytes each: 80,000 bytes, and 40,000 for `wc -m`.
    expect(lint('pkg/CLAUDE.md', 'é'.repeat(40000))).toEqual([])
    expect(lint('pkg/CLAUDE.md', 'é'.repeat(40001))[0]?.message).toContain('has 40001 characters')
    // 40,000 emoji of four bytes each: 160,000 bytes, 80,000 UTF-16 units, 40,000 for `wc -m`.
    expect(lint('pkg/CLAUDE.md', '😀'.repeat(40000))).toEqual([])
    expect(ids(lint('pkg/CLAUDE.md', `${'😀'.repeat(40000)}x`))).toEqual(['tooLong'])
    // `wc -m` counts the carriage return of a CRLF line end.
    expect(ids(lint('pkg/CLAUDE.md', `${chars(39999)}\r\n`))).toEqual(['tooLong'])
  })

  it('names the configured limit at another value of max', () => {
    const messages = lintMemory(RULE, tree({}), 'pkg/CLAUDE.md', chars(151), { max: 150 })
    expect(messages.map((m) => m.message)).toEqual([
      'This file loads on demand and has 151 characters. The configured limit is 150 characters.',
    ])
    expect(lintMemory(RULE, tree({}), 'pkg/CLAUDE.md', chars(150), { max: 150 })).toEqual([])
  })

  it('accepts an integer from 1 up, with no maximum, and nothing else', () => {
    const run = (options: object) => () =>
      lintMemory(RULE, tree({}), 'pkg/CLAUDE.md', 'x\n', options)
    expect(run({ max: 1 })).not.toThrow()
    expect(run({ max: 200000 })).not.toThrow()
    expect(run({ max: 0 })).toThrow()
    expect(run({ max: 1.5 })).toThrow()
    expect(run({ min: 1 })).toThrow()
  })
})

describe(`${RULE}: the files that load on demand`, () => {
  it('reports a CLAUDE.md, a .claude/CLAUDE.md and a CLAUDE.local.md in a subfolder', () => {
    for (const file of [
      'pkg/CLAUDE.md',
      'pkg/.claude/CLAUDE.md',
      'pkg/CLAUDE.local.md',
      'packages/a/b/CLAUDE.md',
    ]) {
      expect(ids(lint(file, chars(40001))), file).toEqual(['tooLong'])
    }
  })

  it('stays silent on the CLAUDE.md files of the start folder, which load at launch', () => {
    for (const file of ['CLAUDE.md', '.claude/CLAUDE.md', 'CLAUDE.local.md']) {
      expect(lint(file, chars(40001)), file).toEqual([])
    }
  })

  it('reports a rule file in the .claude/rules/ of a subfolder, with or without paths', () => {
    expect(ids(lint('pkg/.claude/rules/a.md', chars(40001)))).toEqual(['tooLong'])
    expect(ids(lint('pkg/.claude/rules/deep/a.md', `${SCOPED}${chars(40001)}`))).toEqual([
      'tooLong',
    ])
  })

  it('reports a project rule file with paths, and counts the frontmatter', () => {
    expect(ids(lint('.claude/rules/api.md', `${SCOPED}${chars(40001)}`))).toEqual(['tooLong'])
    expect(
      ids(lint('.claude/rules/api.md', `${SCOPED}${chars(40000 - SCOPED.length + 1)}`)),
    ).toEqual(['tooLong'])
    expect(lint('.claude/rules/api.md', `${SCOPED}${chars(40000 - SCOPED.length)}`)).toEqual([])
    expect(ids(lint('.claude/rules/a/b.md', `---\npaths: "*.ts"\n---\n${chars(40001)}`))).toEqual([
      'tooLong',
    ])
  })

  it('stays silent on a project rule file that sets no scope, which loads at launch', () => {
    expect(lint('.claude/rules/a.md', chars(40001))).toEqual([])
    expect(lint('.claude/rules/a.md', `---\npaths: []\n---\n${chars(40001)}`)).toEqual([])
    expect(lint('.claude/rules/a.md', `---\npaths: ""\n---\n${chars(40001)}`)).toEqual([])
    // YAML that does not parse sets no scope.
    expect(lint('.claude/rules/a.md', `---\npaths: [\n---\n${chars(40001)}`)).toEqual([])
  })

  it('does not check a file that is not a CLAUDE.md or rule file', () => {
    for (const file of ['pkg/AGENTS.md', 'pkg/docs/notes.md', 'pkg/claude.md']) {
      expect(lint(file, chars(40001)), file).toEqual([])
    }
  })
})

describe(`${RULE}: the start folder`, () => {
  it('takes the git top as the start, when .claude/ is in a subfolder of it', () => {
    const files = { 'app/.claude/settings.json': '{}' }
    expect(ids(lint('app/.claude/rules/a.md', chars(40001), files))).toEqual(['tooLong'])
    expect(ids(lint('app/CLAUDE.md', chars(40001), files))).toEqual(['tooLong'])
    expect(ids(lint('app/.claude/CLAUDE.md', chars(40001), files))).toEqual(['tooLong'])
  })

  it('takes the folder of the file as the start when no .git is above it', () => {
    expect(lint('pkg/CLAUDE.md', chars(40001), {}, false)).toEqual([])
    expect(lint('pkg/.claude/rules/a.md', chars(40001), {}, false)).toEqual([])
    expect(ids(lint('pkg/.claude/rules/a.md', `${SCOPED}${chars(40001)}`, {}, false))).toEqual([
      'tooLong',
    ])
  })
})

describe(`${RULE}: imports`, () => {
  const big = chars(40001)

  it('reports an import of a subfolder CLAUDE.md that loads a file over max, at the import', () => {
    const messages = lint('pkg/CLAUDE.md', 'See @notes.md here.\n', { 'pkg/notes.md': big })
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      messageId: 'importTooLong',
      line: 1,
      column: 5,
      endLine: 1,
      endColumn: 14,
    })
    expect(messages[0]?.message).toBe(
      'The file `pkg/notes.md` that this import loads on demand has 40001 characters. Claude gets only the start of an on-demand file of more than 40000 characters.',
    )
  })

  it('reports a file that a chain of imports loads, at the import of the linted file', () => {
    const files = { 'pkg/a.md': '@b.md\n', 'pkg/b.md': big }
    const messages = lint('pkg/CLAUDE.md', '# Pkg\n\n@a.md\n', files)
    expect(ids(messages)).toEqual(['importTooLong'])
    expect(messages[0]).toMatchObject({ line: 3, column: 1 })
    expect(messages[0]?.message).toContain('`pkg/b.md`')
  })

  it('names the configured limit at another value of max', () => {
    const messages = lintMemory(
      RULE,
      tree({ 'pkg/notes.md': chars(11) }),
      'pkg/CLAUDE.md',
      '@notes.md\n',
      { max: 10 },
    )
    expect(messages.map((m) => m.message)).toEqual([
      'The file `pkg/notes.md` that this import loads on demand has 11 characters. The configured limit is 10 characters.',
    ])
  })

  it('stays silent on an import at max, and on the imports of the root CLAUDE.md', () => {
    expect(lint('pkg/CLAUDE.md', '@notes.md\n', { 'pkg/notes.md': chars(40000) })).toEqual([])
    expect(lint('CLAUDE.md', '@notes.md\n', { 'notes.md': big })).toEqual([])
  })

  it('leaves an imported CLAUDE.md or rule file to its own check', () => {
    const files = { 'pkg/sub/CLAUDE.md': big, '.claude/rules/r.md': big }
    expect(lint('pkg/CLAUDE.md', '@sub/CLAUDE.md @../.claude/rules/r.md\n', files)).toEqual([])
  })

  it('does not follow the imports of a rule file', () => {
    expect(lint('pkg/.claude/rules/a.md', '@../../notes.md\n', { 'pkg/notes.md': big })).toEqual([])
  })

  it('makes no report for an import that it cannot find', () => {
    expect(lint('pkg/CLAUDE.md', '@missing.md\n')).toEqual([])
  })
})
