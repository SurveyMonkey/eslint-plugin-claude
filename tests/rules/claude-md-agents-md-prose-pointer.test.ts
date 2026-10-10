// A CLAUDE.md that tells Claude in words to read AGENTS.md works only if Claude decides to open
// the file. The docs say to delete the CLAUDE.md, or to replace the sentence with an `@AGENTS.md`
// import (https://code.claude.com/docs/en/memory#remove-an-earlier-agents-md-workaround). The
// globs are in tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const RULE = 'claude-md-agents-md-prose-pointer'

/** The messages for `code` as the file `file`. */
function lint(code: string, file = '/repo/CLAUDE.md') {
  return lintMarkdown(RULE, code, file)
}

const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

describe(RULE, () => {
  it('reports a sentence that tells Claude to read AGENTS.md, over the paragraph', () => {
    const messages = lint('# Project\n\nRead AGENTS.md for the project instructions.\n')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'prose',
      line: 3,
      column: 1,
      endLine: 3,
      endColumn: 45,
    })
  })

  it('reports other phrases, a code span and a list item, once for the file', () => {
    for (const text of [
      'See AGENTS.md.',
      'Please refer to `AGENTS.md` first.',
      'Follow the rules in AGENTS.md.',
      'Check AGENTS.md before you start.',
      'Open the file AGENTS.md and load it.',
      '- Consult AGENTS.md',
      'read agents.md? No: read AGENTS.md',
    ]) {
      expect(ids(lint(`${text}\n`)), text).toEqual(['prose'])
    }
    expect(ids(lint('Read AGENTS.md.\n\nSee AGENTS.md too.\n'))).toEqual(['prose'])
  })

  it('stays silent when the file imports AGENTS.md', () => {
    expect(lint('@AGENTS.md\n\nRead AGENTS.md for more.\n')).toEqual([])
    expect(lint('Read AGENTS.md.\n\n- @./AGENTS.md\n')).toEqual([])
    expect(lint('Read AGENTS.md.\n\n@../AGENTS.md\n', '/repo/.claude/CLAUDE.md')).toEqual([])
  })

  it('reports when the import is in code, which Claude Code does not load', () => {
    expect(ids(lint('Read AGENTS.md.\n\nWrite `@AGENTS.md` to import.\n'))).toEqual(['prose'])
  })

  it('stays silent on a mention that gives no instruction to read', () => {
    expect(lint('AGENTS.md is shared with other coding tools.\n')).toEqual([])
    expect(lint('Many tools share the same AGENTS.md\n\nRead the docs.\n')).toEqual([])
    expect(lint('Read MYAGENTS.md and AGENTS.md.local\n')).toEqual([])
  })

  it('stays silent on a mention in a fence, a heading or an HTML comment', () => {
    expect(lint('```\nRead AGENTS.md\n```\n')).toEqual([])
    expect(lint('# Read AGENTS.md\n')).toEqual([])
    expect(lint('<!-- Read AGENTS.md -->\n')).toEqual([])
  })

  it('checks a CLAUDE.md in any folder and a .claude/CLAUDE.md, and no other file', () => {
    for (const file of ['/repo/CLAUDE.md', '/repo/.claude/CLAUDE.md', '/repo/web/CLAUDE.md']) {
      expect(ids(lint('Read AGENTS.md.\n', file)), file).toEqual(['prose'])
    }
    for (const file of [
      '/repo/CLAUDE.local.md',
      '/repo/AGENTS.md',
      '/repo/.claude/rules/CLAUDE.md',
      '/repo/docs/notes.md',
    ]) {
      expect(lint('Read AGENTS.md.\n', file), file).toEqual([])
    }
  })
})
