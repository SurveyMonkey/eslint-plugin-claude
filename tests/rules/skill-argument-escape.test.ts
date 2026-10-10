// A doubled backslash before an argument placeholder does not escape it. Both backslashes stay,
// and the placeholder still expands. Claude Code replaces the placeholders in the whole body, so
// the rule reads code too.
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
    // YAML that does not parse: the declared names are not known, so the rule is silent.
    { code: withBody('Price \\\\$1.00', 'description: [unclosed'), filename: skill },
    { code: withBody('Price \\\\$1.00', '[a, b]'), filename: skill },
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
