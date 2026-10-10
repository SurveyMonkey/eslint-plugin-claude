// A subagent with `memory: project` keeps its notes in `.claude/agent-memory/<name>/`
// (https://code.claude.com/docs/en/sub-agents#enable-persistent-memory). A folder with no such
// subagent is an orphan. The rule scans the repository for a project or plugin subagent with that
// `name` and `memory: project`. User agents are out of the repository, so the option `allow` names
// them. Each case builds a tree on disk. The glob is in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, lintMemory, noLinks, tree } from '../memory-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'memory-agent-memory-orphan'

const FILE = '.claude/agent-memory/rev/MEMORY.md'

/** The text of a subagent file. */
const agent = (name: string, extra = 'memory: project\n') =>
  `---\nname: ${name}\ndescription: d\n${extra}---\n\nBody\n`

/** The messages for the index `file` of the tree `files`. */
function lint(files: Record<string, string>, options?: object, file = FILE, git = true) {
  return lintMemory(RULE, tree(files, git), file, '# Memory\n', options)
}

const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

describe(RULE, () => {
  it('reports a folder that no subagent owns, at the start of the index', () => {
    const messages = lint({ '.claude/agent-memory/rev/topic.md': 'x\n' })
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'orphan',
      line: 1,
      column: 1,
    })
    expect(messages[0]?.message).toContain('`rev`')
  })

  it('stays silent when a project subagent with that name sets memory: project', () => {
    expect(lint({ '.claude/agents/rev.md': agent('rev') })).toEqual([])
  })

  it('reads a subagent in a subfolder, in another package, and in a plugin', () => {
    expect(lint({ '.claude/agents/team/any-file.md': agent('rev') })).toEqual([])
    expect(lint({ 'packages/web/.claude/agents/x.md': agent('rev') })).toEqual([])
    expect(
      lint({ 'plugins/p/.claude-plugin/plugin.json': '{}', 'plugins/p/agents/x.md': agent('rev') }),
    ).toEqual([])
  })

  it('reports when the subagent has another name, another memory scope or none', () => {
    expect(ids(lint({ '.claude/agents/other.md': agent('other') }))).toEqual(['orphan'])
    expect(ids(lint({ '.claude/agents/rev.md': agent('rev', 'memory: user\n') }))).toEqual([
      'orphan',
    ])
    expect(ids(lint({ '.claude/agents/rev.md': agent('rev', 'memory: local\n') }))).toEqual([
      'orphan',
    ])
    expect(ids(lint({ '.claude/agents/rev.md': agent('rev', '') }))).toEqual(['orphan'])
    expect(ids(lint({ '.claude/agents/rev.md': agent('rev', 'memory: [project]\n') }))).toEqual([
      'orphan',
    ])
  })

  it('does not count a file that is not a subagent file, or has no usable frontmatter', () => {
    expect(ids(lint({ 'docs/agents/rev.md': agent('rev') }))).toEqual(['orphan'])
    expect(ids(lint({ 'agents/rev.md': agent('rev') }))).toEqual(['orphan'])
    expect(ids(lint({ '.claude/agents/rev.md': '# no frontmatter\n' }))).toEqual(['orphan'])
    expect(ids(lint({ '.claude/agents/rev.md': '---\nname: [\n---\n' }))).toEqual(['orphan'])
    expect(ids(lint({ '.claude/agents/rev.md': '---\nname: 5\nmemory: project\n---\n' }))).toEqual([
      'orphan',
    ])
  })

  it('checks the index file only, once for each folder', () => {
    expect(ids(lint({}, undefined, '.claude/agent-memory/rev/MEMORY.md'))).toEqual(['orphan'])
  })

  it('makes no report for memory that is not in a repository', () => {
    expect(lint({}, undefined, FILE, false)).toEqual([])
  })
})

describe(`${RULE}: the option allow`, () => {
  it('stays silent on a folder whose name is in the list', () => {
    expect(lint({}, { allow: ['rev'] })).toEqual([])
    expect(lint({}, { allow: ['other', 'rev'] })).toEqual([])
    expect(ids(lint({}, { allow: ['other'] }))).toEqual(['orphan'])
    expect(ids(lint({}, { allow: [] }))).toEqual(['orphan'])
    expect(ids(lint({}, {}))).toEqual(['orphan'])
  })

  it('accepts a list of strings and nothing else', () => {
    expect(() => lint({}, { allow: [] })).not.toThrow()
    expect(() => lint({}, { allow: 'rev' })).toThrow()
    expect(() => lint({}, { allow: [1] })).toThrow()
    expect(() => lint({}, { other: [] })).toThrow()
  })
})

describe(`${RULE}: what the rule cannot read`, () => {
  it.skipIf(chmodCannotBlock)('makes no report when a subagent file has no read right', () => {
    const dir = tree({ '.claude/agents/other.md': agent('other') })
    withoutAccess(path.join(dir, '.claude/agents/other.md'), () => {
      expect(lintMemory(RULE, dir, FILE, '# Memory\n')).toEqual([])
    })
  })

  it.skipIf(chmodCannotBlock)('makes no report when a folder has no read right', () => {
    const dir = tree({ 'packages/secret/x.md': 'x\n', '.claude/agents/other.md': agent('other') })
    withoutAccess(path.join(dir, 'packages/secret'), () => {
      expect(lintMemory(RULE, dir, FILE, '# Memory\n')).toEqual([])
    })
  })

  it.skipIf(noLinks)('makes no report when a link leads out of the repository', () => {
    const outside = tree({ 'agents/rev.md': agent('rev') })
    const dir = tree({ '.claude/agents/other.md': agent('other') })
    link(dir, 'out', outside)
    expect(lintMemory(RULE, dir, FILE, '# Memory\n')).toEqual([])
  })

  it.skipIf(noLinks)('reads a subagent behind a link inside the repository', () => {
    const dir = tree({ 'real/agents/x.md': agent('rev'), 'real/.claude-plugin/plugin.json': '{}' })
    link(dir, 'alias', 'real')
    expect(lintMemory(RULE, dir, FILE, '# Memory\n')).toEqual([])
  })
})
