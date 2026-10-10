// The best-practices page says to add emphasis such as "IMPORTANT" to a line that Claude keeps
// skipping, and warns that "if you emphasize many lines, none of them stands out"
// (https://code.claude.com/docs/en/best-practices#write-an-effective-claude-md). The docs give no
// number, so the rule has the option `max` and no default. It makes no report when the option is
// not set. The globs are in tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { lintMemory, tree } from '../memory-tree.test-support.ts'

const RULE = 'claude-md-emphasis-overuse'

/** The messages for `code` as the file `file` of an empty tree, at the option `max`. */
function lint(code: string, max: number | null = 2, file = 'CLAUDE.md') {
  return lintMemory(RULE, tree({}), file, code, max === null ? undefined : { max })
}

const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

/** `count` lines that each hold an emphasis word. */
const emphatic = (count: number) =>
  Array.from({ length: count }, (_, i) => `- IMPORTANT rule ${i + 1}\n`).join('')

describe(RULE, () => {
  it.fails('makes no report when max is not set, however many lines are emphatic', () => {
    expect(lint(emphatic(50), null)).toEqual([])
    expect(lintMemory(RULE, tree({}), 'CLAUDE.md', emphatic(50), {})).toEqual([])
    // The test must be able to fail: the same text reports at a set limit.
    expect(ids(lint(emphatic(50), 2))).toEqual(['tooMany'])
  })

  it.fails('reports once, on the first line past max, and names the count and the limit', () => {
    const messages = lint(`# Rules\n\n${emphatic(4)}`)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'tooMany',
      line: 5,
      column: 1,
      endLine: 5,
      endColumn: 21,
    })
    expect(messages[0]?.message).toBe(
      '4 lines of this file use emphasis words such as IMPORTANT or MUST. The configured limit is 2 lines. If you emphasize many lines, none of them stands out.',
    )
  })

  it.fails('stays silent on max lines, and reports one line over', () => {
    expect(lint(emphatic(2), 2)).toEqual([])
    expect(ids(lint(emphatic(3), 2))).toEqual(['tooMany'])
    expect(lint(emphatic(1), 1)).toEqual([])
    expect(ids(lint(emphatic(2), 1))).toEqual(['tooMany'])
  })

  it.fails('counts lines, not words', () => {
    expect(
      lint('IMPORTANT: you MUST and NEVER skip this.\nALWAYS do it.\nOther text.\n', 2),
    ).toEqual([])
    expect(ids(lint('IMPORTANT MUST NEVER\nALWAYS\nCRITICAL\n', 2))).toEqual(['tooMany'])
  })

  it.fails('counts each line of a paragraph apart', () => {
    const messages = lint('Text\nMUST a\nNEVER b\nplain\nALWAYS c\n', 2)
    expect(messages.map((m) => m.line)).toEqual([5])
  })

  it.fails('counts each word of the list, in capitals and as a whole word', () => {
    for (const word of [
      'IMPORTANT',
      'CRITICAL',
      'MUST',
      'NEVER',
      'ALWAYS',
      'SHALL',
      'REQUIRED',
      'DO NOT',
    ]) {
      expect(ids(lint(`${word} a\n${word} b\n${word} c\n`, 2)), word).toEqual(['tooMany'])
    }
  })

  it.fails('stays silent on lower case, a longer word and other capital words', () => {
    const text = 'must a\nNever b\nalways c\nMUSTARD d\nIMPORTANTLY e\nAPI f\nJSON g\nREADME h\n'
    expect(lint(text, 1)).toEqual([])
  })

  it.fails('counts a strong or emphasis span in capitals', () => {
    expect(ids(lint('**NO EXCEPTIONS** a\n_ONLY HERE_ b\n*ALL* c\n', 2))).toEqual(['tooMany'])
    expect(lint('**Note** a\n**Run it** b\n*care* c\n**OK** d\n', 1)).toEqual([])
  })

  it.fails('counts a word in a heading, a link and a table', () => {
    expect(ids(lint('# MUST read\n[NEVER skip](a.md)\n\n| a |\n|---|\n| ALWAYS |\n', 2))).toEqual([
      'tooMany',
    ])
  })

  it.fails('stays silent on a word in a code span, a fenced block or an HTML comment', () => {
    const text =
      '`MUST` a\n\n```\nIMPORTANT\nNEVER\n```\n\n<!-- ALWAYS -->\n\n    CRITICAL indented\n'
    expect(lint(text, 1)).toEqual([])
  })

  it.fails('checks a CLAUDE.md, a .claude/CLAUDE.md and a CLAUDE.local.md', () => {
    for (const file of ['CLAUDE.md', '.claude/CLAUDE.md', 'CLAUDE.local.md', 'web/CLAUDE.md']) {
      expect(ids(lint(emphatic(3), 2, file)), file).toEqual(['tooMany'])
    }
  })

  it.fails('does not check a rule file, even one named CLAUDE.md, or another file', () => {
    for (const file of ['.claude/rules/a.md', '.claude/rules/CLAUDE.md', 'docs/notes.md']) {
      expect(lint(emphatic(3), 2, file), file).toEqual([])
    }
  })

  it.fails('accepts an integer from 1 up and nothing else', () => {
    expect(() => lint('x\n', 1)).not.toThrow()
    expect(() => lint('x\n', 0)).toThrow()
    expect(() => lint('x\n', 1.5)).toThrow()
    expect(() => lintMemory(RULE, tree({}), 'CLAUDE.md', 'x\n', { min: 1 })).toThrow()
  })
})
