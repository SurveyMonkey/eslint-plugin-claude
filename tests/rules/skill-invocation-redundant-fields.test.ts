// A field that no caller can use: `when_to_use` on a skill that Claude cannot invoke, and
// `argument-hint` on a skill that the user cannot invoke. The rule reads skill files only.
import { pluginSkill } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const skill = '.claude/skills/s/SKILL.md'
const file = (fields: string, filename = skill) => ({
  code: `---\n${fields}---\n\n# S\n`,
  filename,
})

markdownTester.run(
  'skill-invocation-redundant-fields',
  ruleOf('skill-invocation-redundant-fields'),
  {
    valid: [
      file('when_to_use: x\nargument-hint: y\n'),
      file('disable-model-invocation: true\nargument-hint: y\n'),
      file('user-invocable: false\nwhen_to_use: x\n'),
      file('disable-model-invocation: false\nwhen_to_use: x\n'),
      file('user-invocable: true\nargument-hint: y\n'),
      // A field with no value is the same as an absent field.
      file('disable-model-invocation: true\nwhen_to_use:\n'),
      file('user-invocable: false\nargument-hint:\n'),
      file('disable-model-invocation: true\nwhen_to_use: "  "\n'),
      file('user-invocable: false\nargument-hint: []\n'),
      // A setting that is no Boolean form blocks nothing.
      file('disable-model-invocation: maybe\nwhen_to_use: x\n'),
      file('user-invocable: maybe\nargument-hint: x\n'),
      // The rule reads skill files only.
      file('disable-model-invocation: true\nwhen_to_use: x\n', '.claude/commands/c.md'),
      file('disable-model-invocation: true\nwhen_to_use: x\n', 'docs/SKILL.md'),
      { code: '# No frontmatter\n', filename: skill },
      file('disable-model-invocation: true\nwhen_to_use: [x\n'),
    ],
    invalid: [
      {
        ...file('disable-model-invocation: true\nwhen_to_use: Use after a release.\n'),
        errors: [
          {
            // The message says no more than the docs.
            message:
              '`when_to_use` has no use with `disable-model-invocation: true`. The skill listing leaves out the description of the skill, and `when_to_use` is part of it.',
            line: 3,
            column: 1,
            endLine: 3,
            endColumn: 34,
          },
        ],
      },
      {
        ...file('user-invocable: false\nargument-hint: "[issue-number]"\n'),
        errors: [
          {
            message:
              '`argument-hint` has no use with `user-invocable: false`. Claude Code hides the skill from the `/` menu, so no autocomplete shows the hint.',
            line: 3,
            column: 1,
            endLine: 3,
            endColumn: 32,
          },
        ],
      },
      // The docs example writes the hint as a list.
      {
        ...file('user-invocable: false\nargument-hint: [issue-number]\n'),
        errors: [{ messageId: 'argumentHint' }],
      },
      // The Boolean forms that Claude Code reads.
      {
        ...file('disable-model-invocation: yes\nwhen_to_use: x\n'),
        errors: [{ messageId: 'whenToUse' }],
      },
      {
        ...file('user-invocable: off\nargument-hint: x\n'),
        errors: [{ messageId: 'argumentHint' }],
      },
      { ...file('user-invocable: 0\nargument-hint: x\n'), errors: [{ messageId: 'argumentHint' }] },
      // Both faults in one skill.
      {
        ...file(
          'disable-model-invocation: true\nuser-invocable: false\nwhen_to_use: x\nargument-hint: y\n',
        ),
        errors: [
          { messageId: 'whenToUse', line: 4 },
          { messageId: 'argumentHint', line: 5 },
        ],
      },
      // A plugin skill is checked too.
      {
        ...file('disable-model-invocation: true\nwhen_to_use: x\n', pluginSkill()),
        errors: [{ messageId: 'whenToUse' }],
      },
    ],
  },
)
