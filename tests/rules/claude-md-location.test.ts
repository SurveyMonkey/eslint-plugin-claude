// Claude Code loads `CLAUDE.md`, `.claude/CLAUDE.md` and `CLAUDE.local.md` from a project folder
// (https://code.claude.com/docs/en/memory#choose-where-to-put-claude-md-files). The table of the
// docs does not list `.claude/CLAUDE.local.md`, and it names the files in capitals. The rule
// reports a file at such a place or name. The globs are in tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const RULE = 'claude-md-location'

/** The messages for the file `file`. */
function lint(file: string, code = '# Notes\n') {
  return lintMarkdown(RULE, code, file)
}

const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

describe(RULE, () => {
  it('reports a CLAUDE.local.md in the .claude folder, at the start of the file', () => {
    const messages = lint('/repo/.claude/CLAUDE.local.md')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'localInClaude',
      line: 1,
      column: 1,
    })
    expect(messages[0]?.message).toContain('`CLAUDE.local.md`')
  })

  it('reports a case variant of a name that Claude Code loads', () => {
    for (const file of [
      '/repo/claude.md',
      '/repo/Claude.md',
      '/repo/web/claude.md',
      '/repo/.claude/claude.md',
      '/repo/claude.local.md',
      '/repo/CLAUDE.LOCAL.md',
      '/repo/Claude.Local.md',
    ]) {
      expect(ids(lint(file)), file).toEqual(['caseVariant'])
    }
    expect(lint('/repo/claude.md')[0]?.message).toContain('`claude.md`')
  })

  it('stays silent on the names and places that Claude Code loads', () => {
    for (const file of [
      '/repo/CLAUDE.md',
      '/repo/.claude/CLAUDE.md',
      '/repo/CLAUDE.local.md',
      '/repo/web/CLAUDE.md',
      '/repo/web/CLAUDE.local.md',
    ]) {
      expect(lint(file), file).toEqual([])
    }
  })

  it('stays silent on a command, subagent, skill or output style named claude.md', () => {
    for (const file of [
      '/repo/.claude/commands/claude.md',
      '/repo/.claude/agents/claude.md',
      '/repo/.claude/skills/x/claude.md',
      '/repo/.claude/output-styles/Claude.md',
    ]) {
      expect(lint(file), file).toEqual([])
    }
  })

  it('reports a claude.md in a folder named like a tool folder outside .claude', () => {
    for (const file of [
      '/repo/commands/claude.md',
      '/repo/skills/claude.md',
      '/repo/docs/agents/Claude.md',
    ]) {
      expect(ids(lint(file)), file).toEqual(['caseVariant'])
    }
    expect(lint('/repo/.claude/commands/CLAUDE.local.md')).toEqual([])
  })

  it('stays silent on a file with another name', () => {
    for (const file of [
      '/repo/README.md',
      '/repo/claude-notes.md',
      '/repo/docs/claude.md.md',
      '/repo/.claude/sub/CLAUDE.local.md',
      '/repo/my.claude/CLAUDE.local.md',
      '/repo/AGENTS.md',
    ]) {
      expect(lint(file), file).toEqual([])
    }
  })

  it('leaves a rule file and a file that Claude Code never reads to their own rules', () => {
    for (const file of [
      '/repo/.claude/rules/claude.md',
      '/repo/.claude/rules/CLAUDE.local.md',
      '/repo/.agents/claude.md',
      '/repo/.agents/CLAUDE.local.md',
    ]) {
      expect(lint(file), file).toEqual([])
    }
  })
})
