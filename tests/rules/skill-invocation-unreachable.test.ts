// The rule reports a skill that blocks both callers: Claude and the user.
import { pluginSkill } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const skill = '.claude/skills/s/SKILL.md'
const file = (fields: string, filename = skill) => ({
  code: `---\n${fields}---\n\n# S\n`,
  filename,
})

markdownTester.run('skill-invocation-unreachable', ruleOf('skill-invocation-unreachable'), {
  valid: [
    file('disable-model-invocation: true\n'),
    file('user-invocable: false\n'),
    file('disable-model-invocation: true\nuser-invocable: true\n'),
    file('disable-model-invocation: false\nuser-invocable: false\n'),
    file('disable-model-invocation: maybe\nuser-invocable: false\n'),
    file('disable-model-invocation: true\nuser-invocable: maybe\n'),
    file('description: d\n'),
    // A list is not a Boolean.
    file('disable-model-invocation: [true]\nuser-invocable: [false]\n'),
    file('disable-model-invocation: true\nuser-invocable: { a: false }\n'),
    // The rule reads skill files only. It skips a command file.
    file('disable-model-invocation: true\nuser-invocable: false\n', '.claude/commands/c.md'),
    file('disable-model-invocation: true\nuser-invocable: false\n', 'docs/SKILL.md'),
    { code: '# No frontmatter\n', filename: skill },
    file('disable-model-invocation: [true\nuser-invocable: false\n'),
  ],
  invalid: [
    {
      ...file('disable-model-invocation: true\nuser-invocable: false\n'),
      errors: [
        {
          // The message says no more than the rule doc.
          message:
            '`disable-model-invocation: true` means that Claude cannot invoke this skill on its own, and `user-invocable: false` means that the user cannot invoke it.',
          line: 2,
          column: 1,
          endLine: 2,
          endColumn: 31,
        },
      ],
    },
    {
      ...file('user-invocable: false\ndisable-model-invocation: true\n'),
      errors: [{ messageId: 'unreachable', line: 3 }],
    },
    // A plugin skill is checked too.
    {
      ...file('disable-model-invocation: true\nuser-invocable: false\n', pluginSkill()),
      errors: [{ messageId: 'unreachable' }],
    },
    // The boolean forms that Claude Code reads.
    {
      ...file('disable-model-invocation: Yes\nuser-invocable: No\n'),
      errors: [{ messageId: 'unreachable', line: 2, column: 1, endLine: 2, endColumn: 30 }],
    },
    {
      ...file('disable-model-invocation: on\nuser-invocable: off\n'),
      errors: [{ messageId: 'unreachable' }],
    },
    {
      ...file('disable-model-invocation: 1\nuser-invocable: 0\n'),
      errors: [{ messageId: 'unreachable' }],
    },
  ],
})
