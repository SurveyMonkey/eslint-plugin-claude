// Claude Code shows a warning for an instruction file that is over the recommended length of
// 200 lines. Each rules file counts as a separate file
// (https://code.claude.com/docs/en/memory#my-claude-md-is-too-large). The rule counts the lines
// of each file below `.claude/rules/`. The globs are in tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { lintMemory, tree } from '../memory-tree.test-support.ts'

const RULE = 'rules-max-lines'

/** A text of `count` lines, each ended by a newline. */
const lines = (count: number) => 'x\n'.repeat(count)

/** The messages for `code` as the file `file` of an empty tree. */
const lint = (code: string, file = '.claude/rules/a.md', options?: object) =>
  lintMemory(RULE, tree({}), file, code, options)

const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

describe(RULE, () => {
  it('reports a rule file of 201 lines, at the start of the file', () => {
    const messages = lint(lines(201))
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'tooLong',
      line: 1,
      column: 1,
    })
    expect(messages[0]?.message).toContain('201 lines')
    expect(messages[0]?.message).toContain('200 lines')
  })

  it('stays silent on a rule file of 200 lines', () => {
    expect(lint(lines(200))).toEqual([])
    // U+2028 and U+2029 do not end a line in Markdown.
    expect(lint(`${lines(199)}a${String.fromCharCode(0x2028, 0x2029)}b\n`)).toEqual([])
    expect(lint('')).toEqual([])
  })

  it('counts every line, with the frontmatter, and a last line with no line end', () => {
    expect(lint(`---\npaths:\n  - "src/**"\n---\n${lines(196)}`)).toEqual([])
    expect(lint(`---\npaths:\n  - "src/**"\n---\n${lines(197)}`)).toHaveLength(1)
    expect(lint(`${lines(200)}y`)).toHaveLength(1)
    expect(lint(lines(201).replaceAll('\n', '\r\n'))).toHaveLength(1)
  })

  it('checks a rule file at any depth, in any folder that has .claude/rules', () => {
    for (const file of [
      '.claude/rules/sub/deep/b.md',
      'packages/web/.claude/rules/c.md',
      '.claude/rules/CLAUDE.md',
      '.claude/rules/AGENTS.md',
    ]) {
      expect(ids(lint(lines(201), file)), file).toEqual(['tooLong'])
    }
  })

  it('does not check a file outside .claude/rules', () => {
    for (const file of ['CLAUDE.md', '.claude/CLAUDE.md', 'AGENTS.md', 'docs/rules/a.md', 'a.md']) {
      expect(lint(lines(201), file), file).toEqual([])
    }
  })

  it('moves the limit with the option max, and names it in the message', () => {
    expect(lint(lines(3), '.claude/rules/a.md', { max: 3 })).toEqual([])
    const messages = lint(lines(4), '.claude/rules/a.md', { max: 3 })
    expect(ids(messages)).toEqual(['overConfiguredLimit'])
    expect(messages[0]?.message).toBe('This file has 4 lines. The configured limit is 3 lines.')
    expect(lint(lines(201), '.claude/rules/a.md', { max: 300 })).toEqual([])
  })

  it('accepts an integer from 1 up, with no maximum, and nothing else', () => {
    expect(() => lint('x\n', '.claude/rules/a.md', { max: 1 })).not.toThrow()
    expect(() => lint('x\n', '.claude/rules/a.md', { max: 100000 })).not.toThrow()
    expect(() => lint('x\n', '.claude/rules/a.md', { max: 0 })).toThrow()
    expect(() => lint('x\n', '.claude/rules/a.md', { max: 1.5 })).toThrow()
    expect(() => lint('x\n', '.claude/rules/a.md', { min: 1 })).toThrow()
  })
})
