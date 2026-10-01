// An inline `!` placeholder runs after whitespace or at the start of a line.
// After any other character, it stays literal text.
import { pluginSkill } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const skill = '.claude/skills/s/SKILL.md'
const command = '.claude/commands/c.md'
const body = (text: string, filename = skill) => ({
  code: `---\nname: s\n---\n\n${text}\n`,
  filename,
})

markdownTester.run('skill-inject-bang-position', ruleOf('skill-inject-bang-position'), {
  valid: [
    body('!`git diff HEAD`'),
    body('- PR diff: !`gh pr diff`'),
    body('Branch:\t!`git branch`'),
    body('- !`git status`'),
    { code: '!`git diff HEAD`\n', filename: skill },
    { code: 'No placeholder here.\n', filename: command },
    // A `!` not followed by a backtick, and an unclosed placeholder.
    body('Done!'),
    body('KEY=! `cmd` and KEY=!`cmd'),
    // The inline code form of the placeholder in a text about skills.
    body('Write `` !`<command>` `` to run a command, or ``!`cmd`` in a table.'),
    // A code span that ends in `!` is not a placeholder.
    body('Run `git push --force!` or `git status` to check.'),
    body('Say `Done!` then `exit` and `ok!`.'),
    // Fenced code.
    body('```sh\nKEY=!`cmd`\n```'),
    body('~~~\nKEY=!`cmd`\n~~~'),
    body('- item\n\n  ```sh\n  KEY=!`cmd`\n  ```'),
    // Indented code is not fenced code, but a line that starts with a space is fine.
    body('    !`cmd`'),
    // The frontmatter is not body text.
    { code: '---\nnote: KEY=!`cmd`\n---\n\n# S\n', filename: skill },
    { code: '---\nname: [unclosed\n---\n\nKEY=!`cmd`\n', filename: skill },
    { code: 'KEY=!`cmd`\n', filename: 'docs/SKILL.md' },
  ],
  invalid: [
    {
      ...body('KEY=!`cmd`'),
      errors: [{ messageId: 'literal', line: 5, column: 5, endLine: 5, endColumn: 11 }],
    },
    {
      code: 'Run (!`cmd`) now\n',
      filename: command,
      errors: [{ messageId: 'literal', line: 1, column: 6, endColumn: 12 }],
    },
    // A plugin skill is checked too.
    {
      ...body('KEY=!`cmd`', pluginSkill()),
      errors: [{ messageId: 'literal', line: 5 }],
    },
    // A fence that closes, then a placeholder after it.
    {
      ...body('```sh\nok\n```\n\nA:!`one` and !`two` and B-!`three`'),
      errors: [
        { messageId: 'literal', line: 9, column: 3 },
        { messageId: 'literal', line: 9, column: 27 },
      ],
    },
    {
      code: 'x!`cmd`\n',
      filename: skill,
      errors: [{ messageId: 'literal', line: 1, column: 2 }],
    },
  ],
})
