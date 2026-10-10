// A skill or command with no `description`, or one that is empty. A `description` that is
// not a string is a fault of `skill-frontmatter-schema`, so this rule skips it.
import { pluginCommand, pluginSkill } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const skill = '.claude/skills/s/SKILL.md'
const command = '.claude/commands/c.md'
const file = (fields: string, filename = skill) => ({
  code: `---\n${fields}---\n\n# S\n`,
  filename,
})

const MESSAGE =
  '`description` is missing or empty. Claude Code uses the first non-empty line of the content instead. The SDK omits a skill that has neither `description` nor `when_to_use`.'

markdownTester.run('skill-description-present', ruleOf('skill-description-present'), {
  valid: [
    file('description: Deploys the service.\n'),
    file('name: s\ndescription: d\nwhen_to_use: x\n'),
    file('description: d\n', command),
    file('description: d\n', pluginCommand()),
    file('description: d\n', pluginSkill()),
    file('description: |\n  Deploys the service.\n'),
    // A value that is not a string is a fault of the schema rule.
    file('description: 5\n'),
    file('description: [a, b]\n'),
    file('description: { a: b }\n'),
    file('description: false\n'),
    // A block whose top level is a list or a scalar is a fault of the schema rule.
    file('- a\n- b\n'),
    file('just text\n'),
    // Frontmatter that does not parse is a fault of another rule.
    file('description: [unclosed\n'),
    // Not a skill or command file.
    file('name: s\n', 'docs/SKILL.md'),
    { code: '# No frontmatter\n', filename: 'docs/readme.md' },
  ],
  invalid: [
    {
      ...file('name: s\n'),
      errors: [{ message: MESSAGE, line: 1, column: 1, endLine: 3, endColumn: 4 }],
    },
    // No frontmatter: the first body line is the description.
    {
      code: '# Deploy\n\nDeploys the service.\n',
      filename: skill,
      errors: [{ messageId: 'missing', line: 1, column: 1, endLine: 1, endColumn: 1 }],
    },
    { code: '', filename: skill, errors: [{ messageId: 'missing', line: 1, column: 1 }] },
    // A block below line 1 is content, so the file has no description.
    {
      code: '\n---\ndescription: d\n---\n',
      filename: skill,
      errors: [{ messageId: 'missing', line: 1, column: 1 }],
    },
    // A block with no field is valid YAML with no description.
    {
      code: '---\n---\n\n# S\n',
      filename: skill,
      errors: [{ messageId: 'missing', line: 1, column: 1 }],
    },
    {
      code: '---\n# only a comment\n---\n\n# S\n',
      filename: skill,
      errors: [{ messageId: 'missing', line: 1, column: 1 }],
    },
    // An empty value reports on the field.
    {
      ...file('name: s\ndescription:\n'),
      errors: [{ messageId: 'missing', line: 3, column: 1, endLine: 3, endColumn: 13 }],
    },
    {
      ...file('description: null\n'),
      errors: [{ messageId: 'missing', line: 2, column: 1, endLine: 2, endColumn: 18 }],
    },
    {
      ...file('description: ""\n'),
      errors: [{ messageId: 'missing', line: 2, column: 1, endLine: 2, endColumn: 16 }],
    },
    {
      ...file('description: "   "\n'),
      errors: [{ messageId: 'missing', line: 2, column: 1 }],
    },
    {
      ...file('description: |\n\nname: s\n'),
      errors: [{ messageId: 'missing', line: 2, column: 1 }],
    },
    // `when_to_use` does not stand in for `description`.
    { ...file('when_to_use: x\n'), errors: [{ messageId: 'missing' }] },
    // A command file and a plugin skill are checked too.
    { code: '# C\n', filename: command, errors: [{ messageId: 'missing' }] },
    { ...file('model: haiku\n', pluginCommand()), errors: [{ messageId: 'missing' }] },
    { ...file('name: s\n', pluginSkill()), errors: [{ messageId: 'missing' }] },
  ],
})
