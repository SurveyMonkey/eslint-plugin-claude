// A doubled backslash before an argument placeholder does not escape it. Both backslashes stay,
// and the placeholder still expands. The docs give no exemption for code, so the rule reads
// code too.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { lintMarkdown, markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const skill = '.claude/skills/s/SKILL.md'
const command = '.claude/commands/c.md'
const withBody = (body: string, front = 'description: d') => `---\n${front}\n---\n\n${body}\n`

const error = (token: string, extra: object = {}) => ({
  messageId: 'doubled' as const,
  data: { token },
  ...extra,
})

markdownTester.run('skill-argument-escape', ruleOf('skill-argument-escape'), {
  valid: [
    // One backslash escapes the token.
    { code: withBody('Price \\$1.00'), filename: skill },
    { code: withBody('Run \\$ARGUMENTS'), filename: skill },
    { code: withBody('Run \\$issue', 'description: d\narguments: [issue]'), filename: skill },
    // No backslash expands the token, which is the plain use.
    { code: withBody('Fix $ARGUMENTS and $1 and $0'), filename: skill },
    // A doubled backslash before a `$` that is no placeholder. The docs leave it as it is.
    { code: withBody('Path \\\\$HOME and \\\\$'), filename: skill },
    { code: withBody('Cost \\\\$x'), filename: skill },
    // A name that the file does not declare is no placeholder.
    { code: withBody('Run \\\\$issue', 'description: d\narguments: [branch]'), filename: skill },
    // A longer run is out of scope: the docs do not say what it does.
    { code: withBody('Price \\\\\\$1.00'), filename: skill },
    // The token is longer than the name, so it is another word.
    { code: withBody('Run \\\\$issues', 'description: d\narguments: [issue]'), filename: skill },
    { code: withBody('Cost \\\\$1st'), filename: skill },
    // The frontmatter is not the body.
    { code: '---\ndescription: "\\\\$1"\n---\n\nbody\n', filename: skill },
    // YAML that does not parse: the declared names are not known, so a named placeholder is silent.
    { code: withBody('Run \\\\$issue', 'arguments: [issue'), filename: skill },
    // A name with a character that a pattern reads: the name is no pattern.
    {
      code: withBody('Run \\\\$myxname', 'description: d\narguments: [my.name, a+b]'),
      filename: skill,
    },
    // The name `a+b` is no pattern: `aab` does not match it.
    { code: withBody('Run \\\\$aab', 'description: d\narguments: ["a+b"]'), filename: skill },
    // Not a skill or command file.
    { code: withBody('Price \\\\$1.00'), filename: 'docs/readme.md' },
    { code: withBody('Price \\\\$1.00'), filename: 'docs/SKILL.md' },
  ],
  invalid: [
    {
      code: withBody('Price \\\\$1.00'),
      filename: skill,
      errors: [error('$1', { line: 5, column: 7, endLine: 5, endColumn: 11 })],
    },
    { code: withBody('Run \\\\$ARGUMENTS'), filename: skill, errors: [error('$ARGUMENTS')] },
    { code: withBody('Run \\\\$ARGUMENTS[0]'), filename: skill, errors: [error('$ARGUMENTS')] },
    {
      code: withBody('Run \\\\$0 and \\\\$12'),
      filename: skill,
      errors: [error('$0'), error('$12')],
    },
    // A declared name, as a list and as a string.
    {
      code: withBody('Run \\\\$issue', 'description: d\narguments: [issue, branch]'),
      filename: skill,
      errors: [error('$issue')],
    },
    {
      code: withBody('Run \\\\$branch', 'description: d\narguments: issue branch'),
      filename: skill,
      errors: [error('$branch')],
    },
    // A name with a plus sign or a bracket must neither break nor miss the pattern.
    {
      code: withBody('Run \\\\$a+b', 'description: d\narguments: ["a+b"]'),
      filename: skill,
      errors: [error('$a+b')],
    },
    {
      code: withBody('Run \\\\$a(b', 'description: d\narguments: ["a(b"]'),
      filename: skill,
      errors: [error('$a(b')],
    },
    {
      code: withBody('Run \\\\$my.name', 'description: d\narguments: [my.name]'),
      filename: skill,
      errors: [error('$my.name')],
    },
    // Fenced code and inline code are part of the body that Claude Code reads.
    { code: withBody('```bash\necho \\\\$1\n```'), filename: skill, errors: [error('$1')] },
    { code: withBody('Use `\\\\$ARGUMENTS` here'), filename: skill, errors: [error('$ARGUMENTS')] },
    // An empty frontmatter block, and a file with no frontmatter.
    { code: '---\n---\n\nPrice \\\\$1.00\n', filename: skill, errors: [error('$1')] },
    { code: '---\n# c\n---\n\nPrice \\\\$1.00\n', filename: skill, errors: [error('$1')] },
    { code: 'Price \\\\$1.00\n', filename: skill, errors: [error('$1')] },
    // YAML that does not parse: the built-in placeholders need no declared name.
    {
      code: withBody('Price \\\\$1.00', 'description: [unclosed'),
      filename: skill,
      errors: [error('$1')],
    },
    {
      code: withBody('Run \\\\$ARGUMENTS', '[a, b]'),
      filename: skill,
      errors: [error('$ARGUMENTS')],
    },
    // A command file, in a project and in a plugin.
    { code: withBody('Run \\\\$ARGUMENTS'), filename: command, errors: [error('$ARGUMENTS')] },
    // The placeholder with one more backslash further on, on the same line.
    {
      code: withBody('\\\\$1 and \\$1 and \\\\$2'),
      filename: skill,
      errors: [error('$1'), error('$2')],
    },
  ],
})

describe('the message', () => {
  it('names the token and the fix', () => {
    const [message] = lintMarkdown('skill-argument-escape', withBody('Price \\\\$1.00'), skill)
    expect(message?.message).toBe(
      'A doubled backslash does not escape `$1`. Both backslashes stay, and the placeholder still expands. Use one backslash to keep it as text.',
    )
  })
})

describe('a plugin file', () => {
  it('is checked in a plugin command', async () => {
    const { pluginCommand, pluginSkill } = await import('../plugin-fixture.test-support.ts')
    const code = withBody('Run \\\\$ARGUMENTS')
    for (const file of [pluginCommand(), pluginSkill()]) {
      expect(lintMarkdown('skill-argument-escape', code, file)).toHaveLength(1)
    }
  })
})

// A plugin root that is a link out of the repository gives no report.
describe.skipIf(process.platform === 'win32')('a plugin root that the rule cannot see', () => {
  it('makes no report for a link out of the repository, and reports for a real root', () => {
    const scratch = mkdtempSync(path.join(tmpdir(), 'skill-argument-escape-'))
    try {
      mkdirSync(path.join(scratch, 'repo', '.git'), { recursive: true })
      mkdirSync(path.join(scratch, 'repo', 'real', '.claude-plugin'), { recursive: true })
      mkdirSync(path.join(scratch, 'outside', '.claude-plugin'), { recursive: true })
      writeFileSync(path.join(scratch, 'repo', 'real', '.claude-plugin', 'plugin.json'), '{}')
      writeFileSync(path.join(scratch, 'outside', '.claude-plugin', 'plugin.json'), '{}')
      symlinkSync('../outside', path.join(scratch, 'repo', 'plug'))
      const lint = (dir: string) =>
        lintMarkdown(
          'skill-argument-escape',
          'Price \\\\$1.00\n',
          path.join(scratch, 'repo', dir, 'SKILL.md'),
        )
      expect(lint('plug')).toEqual([])
      expect(lint('real')).toHaveLength(1)
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })
})
