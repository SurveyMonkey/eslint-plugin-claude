// The MEMORY.md index of a subagent keeps one line for each entry, and detail goes into topic
// files (https://code.claude.com/docs/en/memory#how-it-works). The files glob names the index
// files, so the rule checks no path itself. The glob is in tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { lintMemory, tree } from '../memory-tree.test-support.ts'

const RULE = 'memory-index-entry-format'

const FILE = '.claude/agent-memory/reviewer/MEMORY.md'

/** The messages for `code` as the index file of an empty tree. */
const lint = (code: string) => lintMemory(RULE, tree({}), FILE, code)

const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

describe(RULE, () => {
  it('reports an entry that goes on to a second line, over the whole entry', () => {
    const messages = lint(
      '# Index\n\n- [Testing](testing.md) first line\n  and a second line\n- [Style](style.md)\n',
    )
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'multiLine',
      line: 3,
      column: 1,
      endLine: 4,
      endColumn: 20,
    })
    expect(messages[0]?.message).toBe(
      'This index entry takes 2 lines. Keep each entry to one line, and move the detail into a topic file.',
    )
  })

  it('stays silent on entries of one line, of any length', () => {
    expect(
      lint('- [Testing](testing.md): run the suite first\n- [Style](style.md): tabs\n'),
    ).toEqual([])
    expect(lint(`- ${'long '.repeat(100)}\n`)).toEqual([])
    expect(lint('1. [Testing](testing.md)\n2. [Style](style.md)\n')).toEqual([])
    expect(lint('')).toEqual([])
  })

  it('reports an entry with a nested list, a second paragraph or a code block', () => {
    for (const text of [
      '- [Testing](testing.md)\n  - detail\n',
      '- [Testing](testing.md)\n\n  More detail.\n',
      '- [Testing](testing.md)\n  ```\n  code\n  ```\n',
    ]) {
      expect(ids(lint(text)), text).toEqual(['multiLine'])
    }
  })

  it('reports each long entry once, and an entry of a nested list as part of its parent', () => {
    const messages = lint('- a\n  b\n- c\n- d\n  e\n  f\n')
    expect(messages.map((m) => [m.line, m.endLine])).toEqual([
      [1, 2],
      [4, 6],
    ])
    expect(lint('- a\n  - b\n    c\n')).toHaveLength(1)
  })

  it('reports a numbered entry and an entry in a loose list', () => {
    expect(ids(lint('1. a\n   b\n'))).toEqual(['multiLine'])
    expect(ids(lint('- a\n\n- b\n  c\n'))).toEqual(['multiLine'])
  })

  it('stays silent on text that is not an entry', () => {
    expect(lint('# Index\n\nNotes that\nrun on.\n')).toEqual([])
    expect(lint('---\nname: reviewer\ndescription: notes\n---\n- a\n')).toEqual([])
    expect(lint('```\n- a\n  b\n```\n')).toEqual([])
    expect(lint('<!--\n- a\n  b\n-->\n')).toEqual([])
    expect(lint('> - a\n>   b\n')).toEqual([])
  })
})
