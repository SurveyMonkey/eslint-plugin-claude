// An unescaped `$` and a digit expands to an argument. The rule reports the digit forms that read
// as an amount: digits, then a decimal point or a comma and a digit, such as `$1.00`. The docs
// give no exemption for code, so the rule reads fenced and inline code too. It does not report
// `$ARGUMENTS`, which has no static tell.
import { describe, expect, it } from 'vitest'
import { pluginCommand, pluginSkill } from '../plugin-fixture.test-support.ts'
import { lintMarkdown, markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const skill = '.claude/skills/s/SKILL.md'
const command = '.claude/commands/c.md'

const error = (token: string, line: number, column: number) => ({
  messageId: 'literal' as const,
  data: { token },
  line,
  column,
  endLine: line,
  endColumn: column + token.length,
})

markdownTester.run('skill-literal-dollar', ruleOf('skill-literal-dollar'), {
  valid: [
    // The escape that the docs give.
    { code: 'The fee is \\$1.00 a month.\n', filename: skill },
    { code: 'The fee is \\$1,000 a year.\n', filename: skill },
    // A placeholder, not an amount: the digit ends the token.
    { code: 'Fix issue $1 now.\n', filename: skill },
    { code: 'Fix issue $1.\n', filename: skill },
    { code: 'Fix issue $1, then $2.\n', filename: skill },
    { code: 'Fix issue $1. Then $2.\n', filename: skill },
    { code: 'Fix issue $1.x\n', filename: skill },
    { code: 'Move $1 to $2.\n', filename: skill },
    { code: 'Migrate $0.\n', filename: skill },
    // A dollar sign that no digit follows.
    { code: 'The fee is $ 1.00.\n', filename: skill },
    { code: 'The fee is $.50 a month.\n', filename: skill },
    { code: 'Use $HOME/.config and $ARGUMENTS.\n', filename: skill },
    { code: `Use \${HOME}.5 here.\n`, filename: skill },
    { code: `Read \${CLAUDE_SKILL_DIR}/notes.md\n`, filename: skill },
    // A doubled backslash is for `skill-argument-escape`.
    { code: 'The fee is \\\\$1.00 a month.\n', filename: skill },
    // The frontmatter is not the body.
    { code: '---\ndescription: Costs $1.00\n---\n\nBody.\n', filename: skill },
    // A file that is no skill or command file.
    { code: 'The fee is $1.00 a month.\n', filename: 'README.md' },
    { code: 'The fee is $1.00 a month.\n', filename: 'docs/SKILL.md' },
  ],
  invalid: [
    { code: 'The fee is $1.00 a month.\n', filename: skill, errors: [error('$1', 1, 12)] },
    { code: 'The fee is $1,000 a year.\n', filename: skill, errors: [error('$1', 1, 12)] },
    { code: 'The fee is $12.50 a month.\n', filename: skill, errors: [error('$12', 1, 12)] },
    { code: 'Pay $0.99.\n', filename: skill, errors: [error('$0', 1, 5)] },
    { code: 'Pay $10,500.\n', filename: skill, errors: [error('$10', 1, 5)] },
    // A single backslash before a different `$` leaves this one unescaped.
    {
      code: 'Pay \\$1.00 or $2.00.\n',
      filename: skill,
      errors: [error('$2', 1, 15)],
    },
    // One report for each amount.
    {
      code: 'From $1.00 to $2.50.\n',
      filename: skill,
      errors: [error('$1', 1, 6), error('$2', 1, 15)],
    },
    // The docs give no exemption for code.
    {
      code: 'Run `price $1.00` now.\n',
      filename: skill,
      errors: [error('$1', 1, 12)],
    },
    {
      code: '```text\nprice $3.20\n```\n',
      filename: skill,
      errors: [error('$3', 2, 7)],
    },
    // The body, after the frontmatter. The block does not need to parse.
    {
      code: '---\ndescription: d\n---\n\nPay $1.00.\n',
      filename: skill,
      errors: [error('$1', 5, 5)],
    },
    {
      code: '---\nname: [unclosed\n---\n\nPay $1.00.\n',
      filename: skill,
      errors: [error('$1', 5, 5)],
    },
    // A command file, a plugin skill and a plugin command.
    { code: 'Pay $1.00.\n', filename: command, errors: [error('$1', 1, 5)] },
    { code: 'Pay $1.00.\n', filename: pluginSkill(), errors: [error('$1', 1, 5)] },
    { code: 'Pay $1.00.\n', filename: pluginCommand(), errors: [error('$1', 1, 5)] },
  ],
})

describe('the message', () => {
  it('names the token and the escape', () => {
    const found = lintMarkdown('skill-literal-dollar', 'Pay $1.00.\n', skill)
    expect(found.map((m) => m.message)).toEqual([
      'Claude Code replaces `$1` with an argument. Write `\\$1` to keep it as text.',
    ])
  })
})
