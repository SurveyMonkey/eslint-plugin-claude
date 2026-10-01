// The rule reports a frontmatter block that Claude Code reads as body text:
// the opening `---` is not line 1.
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const skill = '.claude/skills/s/SKILL.md'
const command = '.claude/commands/c.md'
const block = '---\nname: s\ndescription: d\n---\n\n# S\n'

markdownTester.run('skill-frontmatter-position', ruleOf('skill-frontmatter-position'), {
  valid: [
    { code: block, filename: skill },
    { code: block, filename: command },
    { code: '# S\n\nText.\n', filename: skill },
    // A rule between two sections is not a block.
    { code: '# S\n\n---\n\nText.\n\n---\n\nMore.\n', filename: skill },
    // A block whose lines are not a mapping, or whose keys are not fields.
    { code: '\n---\nnot: [closed\n---\n', filename: skill },
    { code: '\n---\nmade-up: 1\n---\n', filename: skill },
    // A block with no closing line.
    { code: '\n---\nname: s\n', filename: skill },
    // A block in fenced code, as in a skill that teaches frontmatter.
    { code: '# S\n\n```yaml\n---\nname: s\n---\n```\n', filename: skill },
    // A file that is not a skill or a command file.
    { code: '\n---\nname: s\n---\n', filename: 'docs/SKILL.md' },
    // Frontmatter that does not parse is the concern of Claude Code, not of this rule.
    { code: '---\nname: [unclosed\n---\n', filename: skill },
  ],
  invalid: [
    {
      code: '\n---\nname: s\ndescription: d\n---\n\n# S\n',
      filename: skill,
      errors: [{ messageId: 'notFirst', line: 2, column: 1, endLine: 2, endColumn: 4 }],
    },
    {
      code: '# S\n---\nname: s\n---\n',
      filename: command,
      errors: [{ messageId: 'notFirst', line: 2, column: 1 }],
    },
    {
      code: 'Intro text.\n\n---\ndescription: d\n...\n',
      filename: skill,
      errors: [{ messageId: 'notFirst', line: 3 }],
    },
  ],
})
