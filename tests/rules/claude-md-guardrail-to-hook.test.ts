// CLAUDE.md is context, not enforced configuration. To block an action whatever Claude decides,
// the docs say to use a PreToolUse hook
// (https://code.claude.com/docs/en/features-overview#compare-similar-features). A step that must
// run at a fixed point, such as before every commit, is a hook too
// (https://code.claude.com/docs/en/memory#claude-isnt-following-my-claude-md). The rule is a
// heuristic on the words of a guardrail. The globs are in tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const RULE = 'claude-md-guardrail-to-hook'

/** The messages for `code` as the file `file`. */
function lint(code: string, file = '/repo/CLAUDE.md') {
  return lintMarkdown(RULE, code, file)
}

const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

describe(RULE, () => {
  it('reports a prohibition, over the words that make it', () => {
    const messages = lint('# Files\n\nNever edit `src/generated.ts` by hand.\n')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'guardrail',
      line: 3,
      column: 1,
      endLine: 3,
      endColumn: 11,
    })
    expect(messages[0]?.message).toBe(
      'This wording is a guardrail. Claude treats CLAUDE.md as context, and may not follow it. To block or require an action every time, use a `PreToolUse` hook or a permission rule.',
    )
  })

  it('reports each verb and each form of the prohibition', () => {
    for (const text of [
      'Never edit the lock file.',
      'Do not modify the migrations.',
      "Don't overwrite the config.",
      'You must not touch the vendor folder.',
      'Never write to dist.',
      'We should not delete branches.',
      'Never commit secrets.',
      'Never push to main.',
      'Never force-push.',
      'Never ever run rm.',
      'Do not read the .env file.',
      'NEVER EDIT the schema.',
    ]) {
      expect(ids(lint(`${text}\n`)), text).toEqual(['guardrail'])
    }
  })

  it('reports an action that must happen at a fixed point', () => {
    for (const text of [
      'Always run the tests before committing.',
      'Always run `pnpm lint` before you push.',
      'Always format the code before each commit.',
      'Always run the linter after every file edit.',
      'Always run prettier after any change.',
    ]) {
      expect(ids(lint(`${text}\n`)), text).toEqual(['guardrail'])
    }
  })

  it('reports each guardrail, in a list item and in a heading, and one more on the same line', () => {
    const messages = lint(
      '- Never edit a.\n- Do not delete b.\n\n# Never push\n\nNever edit a. Never edit b.\n',
    )
    expect(messages.map((m) => [m.line, m.column])).toEqual([
      [1, 3],
      [2, 3],
      [4, 3],
      [6, 1],
      [6, 15],
    ])
  })

  it('stays silent on neutral text and on a rule that no hook can enforce', () => {
    for (const text of [
      'Use 2-space indentation.',
      'Prefer small commits.',
      'Never use var.',
      'Do not worry about formatting.',
      'Always write clear names.',
      'Always run in a clean checkout.',
      'We never edited this before.',
      'Nevertheless, edit the file.',
      'Run the tests before you push.',
      'The editor never writes to disk.',
    ]) {
      expect(lint(`${text}\n`), text).toEqual([])
    }
  })

  it('stays silent on a guardrail in a fence, a code span or an HTML comment', () => {
    expect(lint('```\nNever edit the lock file.\n```\n')).toEqual([])
    expect(lint('Write `Never edit the lock file` in the prompt.\n')).toEqual([])
    expect(lint('<!-- Never edit the lock file. -->\n')).toEqual([])
    expect(lint('    Never edit the lock file.\n')).toEqual([])
  })

  it('checks a CLAUDE.md, a CLAUDE.local.md and a rule file, and no other file', () => {
    for (const file of [
      '/repo/CLAUDE.md',
      '/repo/.claude/CLAUDE.md',
      '/repo/CLAUDE.local.md',
      '/repo/.claude/rules/style.md',
      '/repo/.claude/rules/web/CLAUDE.md',
    ]) {
      expect(ids(lint('Never edit a.\n', file)), file).toEqual(['guardrail'])
    }
    for (const file of [
      '/repo/docs/notes.md',
      '/repo/AGENTS.md',
      '/repo/.claude/skills/x/SKILL.md',
    ]) {
      expect(lint('Never edit a.\n', file), file).toEqual([])
    }
  })

  it('reports a guardrail in bold, in a block quote, or with a curly apostrophe', () => {
    for (const text of [
      '**NEVER** edit generated files.',
      '*Never* commit to main.',
      'Do **not** edit generated files.',
      'You **must not** push to main.',
      '_Never_ edit generated files.',
      '__NEVER__ edit generated files.',
      '> > Never\n> > edit generated files.',
      '- > Never\n  > edit generated files.',
      '> Never\n> edit generated files.',
      'Don\u2019t edit generated files.',
    ]) {
      expect(ids(lint(`${text}\n`)), text).toEqual(['guardrail'])
    }
  })

  it('stays silent on an underscore inside a word', () => {
    expect(lint('Never_edit x.\n')).toEqual([])
    expect(lint('Do_not edit x.\n')).toEqual([])
  })

  it('keeps the place of a match after emphasis marks', () => {
    const messages = lint('Be **kind**. Never edit x.\n')
    expect(messages.map((m) => [m.column, m.endColumn])).toEqual([[14, 24]])
  })

  it('keeps the place of a match after a code span', () => {
    const messages = lint('See `Never edit x` and never edit y.\n')
    expect(messages.map((m) => [m.column, m.endColumn])).toEqual([[24, 34]])
  })

  it('keeps the place of a match on a later line of a block quote', () => {
    const messages = lint('> Be kind.\n> Never edit x.\n')
    expect(messages.map((m) => [m.line, m.column])).toEqual([[2, 3]])
  })
})
