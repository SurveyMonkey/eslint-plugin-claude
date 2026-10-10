// A numbered procedure of many steps does not belong in a CLAUDE.md. The docs say to move a
// multi-step procedure, or a rule that matters for one part of the code, into a skill or a
// path-scoped rule (https://code.claude.com/docs/en/memory#when-to-add-to-claude-md). The docs
// give no number, so the rule has the option `maxSteps` and no default. It makes no report when
// the option is not set. The globs are in tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { lintMemory, tree } from '../memory-tree.test-support.ts'

const RULE = 'claude-md-procedure-to-skill'

/** A numbered list of `count` steps. */
const steps = (count: number, first = 1) =>
  Array.from({ length: count }, (_, i) => `${first + i}. Step ${i + 1}\n`).join('')

/** The messages for `code` as the file `file` of an empty tree, at the option `maxSteps`. */
function lint(code: string, maxSteps: number | null = 3, file = 'CLAUDE.md') {
  return lintMemory(RULE, tree({}), file, code, maxSteps === null ? undefined : { maxSteps })
}

const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

describe(RULE, () => {
  it.fails('makes no report when maxSteps is not set, however long the list is', () => {
    expect(lint(steps(40), null)).toEqual([])
    expect(lintMemory(RULE, tree({}), 'CLAUDE.md', steps(40), {})).toEqual([])
    // The test must be able to fail: the same list reports at a set limit.
    expect(ids(lint(steps(40), 3))).toEqual(['tooManySteps'])
  })

  it.fails('reports a list over maxSteps, over the whole list, and names the limit', () => {
    const messages = lint('# Release\n\n' + steps(4))
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'tooManySteps',
      line: 3,
      column: 1,
      endLine: 6,
      endColumn: 10,
    })
    expect(messages[0]?.message).toBe(
      'This numbered list has 4 steps. The configured limit is 3 steps. Move a long procedure into a skill or a path-scoped rule. Claude loads these only when it needs them.',
    )
  })

  it.fails('stays silent on a list at maxSteps, and reports one step over', () => {
    expect(lint(steps(3), 3)).toEqual([])
    expect(ids(lint(steps(4), 3))).toEqual(['tooManySteps'])
    expect(lint(steps(1), 1)).toEqual([])
    expect(ids(lint(steps(2), 1))).toEqual(['tooManySteps'])
  })

  it.fails('counts the steps of one list, also when a blank line splits them or numbers start late', () => {
    expect(ids(lint('1. a\n\n2. b\n\n3. c\n\n4. d\n'))).toEqual(['tooManySteps'])
    expect(ids(lint(steps(4, 7)))).toEqual(['tooManySteps'])
    expect(ids(lint('1) a\n2) b\n3) c\n4) d\n'))).toEqual(['tooManySteps'])
  })

  it.fails('counts each list on its own, and a nested list apart from its parent', () => {
    expect(lint(`${steps(3)}\nText.\n\n${steps(3)}`)).toEqual([])
    const nested = '1. a\n   1. b\n   2. c\n   3. d\n   4. e\n2. f\n'
    const messages = lint(nested)
    expect(messages.map((m) => [m.line, m.endLine])).toEqual([[2, 5]])
  })

  it.fails('stays silent on a bullet list and on steps in a fence', () => {
    expect(lint('- a\n- b\n- c\n- d\n- e\n')).toEqual([])
    expect(lint('```\n1. a\n2. b\n3. c\n4. d\n```\n')).toEqual([])
    expect(lint('<!--\n1. a\n2. b\n3. c\n4. d\n-->\n')).toEqual([])
  })

  it.fails('checks a CLAUDE.md, a .claude/CLAUDE.md and a CLAUDE.local.md', () => {
    for (const file of ['CLAUDE.md', '.claude/CLAUDE.md', 'CLAUDE.local.md', 'web/CLAUDE.md']) {
      expect(ids(lint(steps(4), 3, file)), file).toEqual(['tooManySteps'])
    }
  })

  it.fails('does not check a rule file, even one named CLAUDE.md, or another file', () => {
    for (const file of ['.claude/rules/release.md', '.claude/rules/CLAUDE.md', 'docs/notes.md']) {
      expect(lint(steps(4), 3, file), file).toEqual([])
    }
  })

  it.fails('accepts an integer from 1 up and nothing else', () => {
    expect(() => lint('x\n', 1)).not.toThrow()
    expect(() => lint('x\n', 0)).toThrow()
    expect(() => lint('x\n', 1.5)).toThrow()
    expect(() => lintMemory(RULE, tree({}), 'CLAUDE.md', 'x\n', { max: 1 })).toThrow()
  })
})
