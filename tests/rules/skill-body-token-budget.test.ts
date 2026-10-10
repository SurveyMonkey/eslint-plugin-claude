// After compaction, Claude Code keeps the first 5,000 tokens of each invoked skill. No setting
// moves that number, so the option `max` has a schema maximum of 5000. The rule estimates a token
// as 4 characters, and it counts the body, not the frontmatter.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { pluginCommand, pluginSkill } from '../plugin-fixture.test-support.ts'
import { lintMarkdown, markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const skill = '.claude/skills/s/SKILL.md'
const command = '.claude/commands/c.md'
const chars = (count: number) => 'a'.repeat(count)
const frontmatter = '---\ndescription: d\n---\n'

const error = (
  messageId: 'overCompactionCap' | 'overConfiguredLimit',
  data: Record<string, string>,
) => ({
  messageId,
  data,
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 1,
})
const over = (tokens: number, max = 5000) =>
  error('overCompactionCap', { tokens: String(tokens), max: String(max) })
const overConfigured = (tokens: number, max: number) =>
  error('overConfiguredLimit', { tokens: String(tokens), max: String(max) })

markdownTester.run('skill-body-token-budget', ruleOf('skill-body-token-budget'), {
  valid: [
    // 20,000 characters are 5,000 tokens, which is the limit and not over it.
    { code: chars(20000), filename: skill },
    { code: '', filename: skill },
    { code: chars(100), filename: skill },
    // The frontmatter is not in the count.
    { code: frontmatter + chars(20000), filename: skill },
    { code: `---\ndescription: ${chars(30000)}\n---\n${chars(100)}`, filename: skill },
    // A CRLF file: the line break that ends the block is not in the count.
    { code: `---\r\ndescription: d\r\n---\r\n${chars(20000)}`, filename: skill },
    // The count does not need the YAML to parse.
    { code: `---\nname: [unclosed\n---\n${chars(100)}`, filename: skill },
    // A command file and a plugin skill are checked the same way.
    { code: chars(20000), filename: command },
    { code: chars(20000), filename: pluginSkill() },
    { code: chars(20000), filename: pluginCommand() },
    // The option at another value: 40 characters are 10 tokens.
    { code: chars(40), filename: skill, options: [{ max: 10 }] },
    { code: chars(16000), filename: skill, options: [{ max: 4000 }] },
    { code: chars(20000), filename: skill, options: [{ max: 5000 }] },
    { code: chars(4), filename: skill, options: [{ max: 1 }] },
    // A file that is no skill or command file.
    { code: chars(30000), filename: 'docs/SKILL.md' },
    { code: chars(30000), filename: 'README.md' },
  ],
  invalid: [
    {
      code: `---\r\ndescription: d\r\n---\r\n${chars(20001)}`,
      filename: skill,
      errors: [over(5001)],
    },
    // One character more than 5,000 tokens is 5,001 tokens.
    { code: chars(20001), filename: skill, errors: [over(5001)] },
    { code: chars(20004), filename: skill, errors: [over(5001)] },
    { code: chars(20005), filename: skill, errors: [over(5002)] },
    { code: chars(40000), filename: skill, errors: [over(10000)] },
    // The body is long, with the frontmatter around it.
    { code: frontmatter + chars(20001), filename: skill, errors: [over(5001)] },
    { code: `---\n---\n${chars(20001)}`, filename: skill, errors: [over(5001)] },
    // A block that does not parse does not hide a long body.
    {
      code: `---\nname: [unclosed\n---\n${chars(20001)}`,
      filename: skill,
      errors: [over(5001)],
    },
    // A command file, a plugin skill and a plugin command.
    { code: chars(20001), filename: command, errors: [over(5001)] },
    { code: chars(20001), filename: pluginSkill(), errors: [over(5001)] },
    { code: chars(20001), filename: pluginCommand(), errors: [over(5001)] },
    // A `SKILL.md` below `commands/` is a command file.
    { code: chars(30000), filename: '.claude/commands/x/SKILL.md', errors: [over(7500)] },
    // A value that equals the docs number gives the docs message.
    { code: chars(20001), filename: skill, options: [{ max: 5000 }], errors: [over(5001)] },
    // Another value gives the message that names the configured limit.
    {
      code: chars(41),
      filename: skill,
      options: [{ max: 10 }],
      errors: [overConfigured(11, 10)],
    },
    {
      code: chars(16001),
      filename: skill,
      options: [{ max: 4000 }],
      errors: [overConfigured(4001, 4000)],
    },
    {
      code: chars(5),
      filename: skill,
      options: [{ max: 1 }],
      errors: [overConfigured(2, 1)],
    },
    {
      code: frontmatter + chars(41),
      filename: command,
      options: [{ max: 10 }],
      errors: [overConfigured(11, 10)],
    },
  ],
})

const messages = (code: string, options: unknown[] = []) =>
  lintMarkdown('skill-body-token-budget', code, skill, options).map((m) => m.message)

describe('the messages', () => {
  it('names the compaction cap at the default', () => {
    expect(messages(chars(24000))).toEqual([
      'The body of this file is about 6000 tokens (characters divided by 4). After compaction, Claude Code keeps the first 5000 tokens of a skill. Move reference material to supporting files.',
    ])
  })

  it('names the configured limit at another value, and claims no compaction cap', () => {
    expect(messages(chars(48), [{ max: 10 }])).toEqual([
      'The body of this file is about 12 tokens (characters divided by 4). The configured limit is 10 tokens. Move reference material to supporting files.',
    ])
  })
})

describe('the options', () => {
  const lint = (option: unknown) =>
    lintMarkdown('skill-body-token-budget', chars(3), skill, [option])

  it.each([
    { maxTokens: 5 },
    { Max: 5 },
    { max: '5' },
    { max: 0 },
    { max: 1.5 },
    { max: -1 },
    // No setting moves the 5,000 tokens that compaction keeps, so a larger limit has no meaning.
    { max: 5001 },
    { max: 1_000_000 },
  ])('refuses %j', (option) => {
    expect(() => lint(option)).toThrow('Key "claude/skill-body-token-budget"')
  })

  it('accepts the largest limit and the smallest', () => {
    expect(() => lint({ max: 5000 })).not.toThrow()
    expect(() => lint({ max: 1 })).not.toThrow()
  })
})

// A plugin root that is a link out of the repository gives no report.
describe.skipIf(process.platform === 'win32')('a plugin root that the rule cannot see', () => {
  it('makes no report for a link out of the repository, and reports for a real root', () => {
    const scratch = mkdtempSync(path.join(tmpdir(), 'skill-body-token-budget-'))
    try {
      mkdirSync(path.join(scratch, 'repo', '.git'), { recursive: true })
      mkdirSync(path.join(scratch, 'repo', 'real', '.claude-plugin'), { recursive: true })
      mkdirSync(path.join(scratch, 'outside', '.claude-plugin'), { recursive: true })
      writeFileSync(path.join(scratch, 'repo', 'real', '.claude-plugin', 'plugin.json'), '{}')
      writeFileSync(path.join(scratch, 'outside', '.claude-plugin', 'plugin.json'), '{}')
      symlinkSync('../outside', path.join(scratch, 'repo', 'plug'))
      const lint = (dir: string) =>
        lintMarkdown(
          'skill-body-token-budget',
          chars(20001),
          path.join(scratch, 'repo', dir, 'SKILL.md'),
        )
      expect(lint('plug')).toEqual([])
      expect(lint('real')).toHaveLength(1)
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })
})
