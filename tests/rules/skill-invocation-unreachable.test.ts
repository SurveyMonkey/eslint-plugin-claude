// The rule reports a skill that blocks both callers: Claude and the user.
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
    // A command file has no `user-invocable` rule: the rule reads skills only.
    file('disable-model-invocation: true\nuser-invocable: false\n', '.claude/commands/c.md'),
    file('disable-model-invocation: true\nuser-invocable: false\n', 'docs/SKILL.md'),
    { code: '# No frontmatter\n', filename: skill },
    file('disable-model-invocation: [true\nuser-invocable: false\n'),
  ],
  invalid: [
    {
      ...file('disable-model-invocation: true\nuser-invocable: false\n'),
      errors: [{ messageId: 'unreachable', line: 2, column: 1, endLine: 2, endColumn: 31 }],
    },
    {
      ...file('user-invocable: false\ndisable-model-invocation: true\n'),
      errors: [{ messageId: 'unreachable', line: 3 }],
    },
    // The boolean forms that Claude Code reads.
    {
      ...file('disable-model-invocation: Yes\nuser-invocable: No\n'),
      errors: [{ messageId: 'unreachable' }],
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
