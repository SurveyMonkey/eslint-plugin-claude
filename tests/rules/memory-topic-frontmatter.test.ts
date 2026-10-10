// Auto memory saves four kinds of notes, and records the kind as a `type` field in the frontmatter
// of the memory file. Claude Code records the write time in a `modified` field as an ISO 8601
// timestamp (https://code.claude.com/docs/en/memory#auto-memory). The docs state this for the
// main auto memory only, so the rule is a heuristic for the topic files of a subagent. The files
// glob names the topic files. The rule leaves the `MEMORY.md` index itself. The glob is in
// tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { lintMemory, tree } from '../memory-tree.test-support.ts'

const RULE = 'memory-topic-frontmatter'

/** The messages for `code` as the file `file` of an empty tree. */
const lint = (code: string, file = '.claude/agent-memory/reviewer/feedback_testing.md') =>
  lintMemory(RULE, tree({}), file, code)

const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

describe(RULE, () => {
  it('reports a type that is none of the four kinds, over the value', () => {
    const messages = lint('---\nname: testing\ntype: note\n---\nBody\n')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'badType',
      line: 3,
      column: 7,
      endLine: 3,
      endColumn: 11,
    })
    expect(messages[0]?.message).toBe(
      '`type` is "note". Claude records one of `user`, `feedback`, `project` or `reference`.',
    )
  })

  it('reports a modified value that is not an ISO 8601 date or timestamp', () => {
    const messages = lint('---\ntype: user\nmodified: Oct 14, 2026\n---\n')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      messageId: 'badModified',
      line: 3,
      column: 11,
      endLine: 3,
      endColumn: 23,
    })
    expect(messages[0]?.message).toBe(
      '`modified` is "Oct 14, 2026". Claude Code writes an ISO 8601 timestamp, such as 2026-10-14T09:30:00Z.',
    )
    for (const value of [
      '14/10/2026',
      '2026-13-01',
      '2026-02-30',
      '2026-10-14T25:00:00Z',
      '2026-10-14T09:61:00Z',
      '2026-10-14 09:30:00',
      '2026-10-14T09',
      'yesterday',
      '"2026-10-14T09:30:00 Z"',
    ]) {
      expect(ids(lint(`---\nmodified: ${value}\n---\n`)), value).toEqual(['badModified'])
    }
  })

  it('reports a value that is not a string, with the value as it reads', () => {
    expect(lint('---\ntype: 3\n---\n')[0]?.message).toContain('`type` is 3.')
    expect(lint('---\ntype: [user]\n---\n')[0]?.message).toContain('`type` is ["user"].')
    expect(lint('---\nmodified: 20261014\n---\n')[0]?.message).toContain('`modified` is 20261014.')
    expect(ids(lint('---\ntype:\n---\n'))).toEqual(['badType'])
  })

  it('reports both fields, each once, in the order of the file', () => {
    expect(ids(lint('---\nmodified: soon\ntype: note\n---\n'))).toEqual(['badModified', 'badType'])
  })

  it('stays silent on each kind and on ISO 8601 values', () => {
    for (const kind of ['user', 'feedback', 'project', 'reference']) {
      expect(lint(`---\ntype: ${kind}\n---\n`), kind).toEqual([])
    }
    for (const value of [
      '2026-10-14T09:30:00Z',
      '2026-10-14T09:30:00.123Z',
      '2026-10-14T09:30:00+02:00',
      '2026-10-14T09:30:00-0500',
      '2026-10-14T09:30Z',
      '2026-10-14T09:30:00',
      '2026-10-14',
      '2028-02-29',
      '"2026-10-14T09:30:00Z"',
    ]) {
      expect(lint(`---\ntype: project\nmodified: ${value}\n---\n`), value).toEqual([])
    }
  })

  it('stays silent on a file with no frontmatter, no field or other fields', () => {
    expect(lint('# Testing\n\nRun the suite first.\n')).toEqual([])
    expect(lint('---\nname: testing\ndescription: d\n---\n')).toEqual([])
    expect(lint('---\n---\nBody\n')).toEqual([])
    expect(lint('Body\n\n---\ntype: note\n---\n')).toEqual([])
  })

  it('stays silent on frontmatter that is not YAML that gives a map', () => {
    expect(lint('---\ntype: [\n---\n')).toEqual([])
    expect(lint('---\n- type: note\n---\n')).toEqual([])
  })

  it('does not check the MEMORY.md index', () => {
    expect(
      lint('---\ntype: note\nmodified: soon\n---\n', '.claude/agent-memory/reviewer/MEMORY.md'),
    ).toEqual([])
  })
})
