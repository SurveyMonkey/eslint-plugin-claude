// A Boolean field that is not `true` or `false`. Claude Code reads the other forms from
// v2.1.218 only. The rule reads the parsed value, so a YAML Boolean passes.
import { pluginCommand, pluginSkill } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const skill = '.claude/skills/s/SKILL.md'
const command = '.claude/commands/c.md'
// The rule is inactive with no `minVersion`, so a case sets a floor before the fix by default.
// A case passes `[]` to set no option.
const BEFORE_FIX = [{ minVersion: '2.1.0' }]
const file = (fields: string, filename = skill, options: object[] = BEFORE_FIX) => ({
  code: `---\n${fields}---\n\n# S\n`,
  filename,
  ...(options.length > 0 ? { options } : {}),
})

// Every form that the skills page lists, in the letter cases it allows, and the forms that
// the Boolean reader accepts in addition (see `src/frontmatter-boolean.ts`).
const FORMS = ['yes', 'no', 'on', 'off', '1', '0', 'Yes', 'NO', 'On', 'OFF', 'yEs']
const QUOTED = ['"true"', "'false'", '"yes"', "'0'", '"1"']
const NUMBERS = ['1.0', '0x1', '01', '0.0']

markdownTester.run('skill-boolean-literal', ruleOf('skill-boolean-literal'), {
  valid: [
    file('disable-model-invocation: true\nuser-invocable: false\n'),
    file('disable-model-invocation: false\nuser-invocable: true\n'),
    file('user-invocable: false\n', command),
    // YAML reads these as Booleans, as every version of Claude Code does.
    file('disable-model-invocation: True\nuser-invocable: FALSE\n'),
    file('disable-model-invocation: TRUE\nuser-invocable: False\n'),
    // A field that is not set, or is empty.
    file('description: d\n'),
    file('disable-model-invocation:\nuser-invocable:\n'),
    // A value that is no Boolean form is not this rule's fault.
    file('disable-model-invocation: maybe\nuser-invocable: 2\n'),
    file('disable-model-invocation: [yes]\nuser-invocable: { a: no }\n'),
    // `background` needs v2.1.218 itself, so its form cannot be the fault.
    file('context: fork\nbackground: no\n'),
    // With no `minVersion`, the rule is inactive.
    file('disable-model-invocation: yes\nuser-invocable: 0\n', skill, []),
    file('user-invocable: no\n', command, []),
    { ...file('user-invocable: no\n', skill, []), options: [{}] },
    // The repository supports a version that reads the forms.
    file('disable-model-invocation: yes\n', skill, [{ minVersion: '2.1.218' }]),
    file('disable-model-invocation: yes\n', skill, [{ minVersion: '2.1.219' }]),
    file('user-invocable: 0\n', command, [{ minVersion: '2.2.0' }]),
    // Not a skill or command file, no frontmatter, and frontmatter that does not parse.
    file('disable-model-invocation: yes\n', 'docs/SKILL.md'),
    { code: '# No frontmatter\n', filename: skill },
    file('disable-model-invocation: [yes\nuser-invocable: no\n'),
  ],
  invalid: [
    ...FORMS.map((form) => ({
      ...file(`disable-model-invocation: ${form}\n`),
      errors: [
        {
          messageId: 'nonLiteral' as const,
          data: { key: 'disable-model-invocation', value: form },
        },
      ],
    })),
    ...QUOTED.map((form) => ({
      ...file(`user-invocable: ${form}\n`),
      errors: [{ messageId: 'nonLiteral' as const, data: { key: 'user-invocable', value: form } }],
    })),
    ...NUMBERS.map((form) => ({
      ...file(`user-invocable: ${form}\n`),
      errors: [{ messageId: 'nonLiteral' as const, data: { key: 'user-invocable', value: form } }],
    })),
    {
      ...file('name: s\ndisable-model-invocation: yes\n'),
      errors: [
        {
          // The message says no more than the docs.
          message:
            '`disable-model-invocation` is set to `yes`, not `true` or `false`. Claude Code before v2.1.218 reads only `true` and `false`.',
          line: 3,
          column: 27,
          endLine: 3,
          endColumn: 30,
        },
      ],
    },
    // Each field gets its own report.
    {
      ...file('disable-model-invocation: on\nuser-invocable: off\n'),
      errors: [
        { messageId: 'nonLiteral', line: 2, column: 27 },
        { messageId: 'nonLiteral', line: 3, column: 17 },
      ],
    },
    // A command file takes the same fields, in a project and in a plugin.
    { ...file('user-invocable: no\n', command), errors: [{ messageId: 'nonLiteral' }] },
    { ...file('user-invocable: no\n', pluginCommand()), errors: [{ messageId: 'nonLiteral' }] },
    { ...file('user-invocable: no\n', pluginSkill()), errors: [{ messageId: 'nonLiteral' }] },
    // A comment after the value is not part of the value.
    {
      ...file('user-invocable: no # hidden\n'),
      errors: [{ messageId: 'nonLiteral', data: { key: 'user-invocable', value: 'no' } }],
    },
    // The repository supports a version before the forms.
    {
      ...file('disable-model-invocation: yes\n', skill, [{ minVersion: '2.1.217' }]),
      errors: [{ messageId: 'nonLiteral' }],
    },
    {
      ...file('disable-model-invocation: yes\n', skill, [{ minVersion: '2.0.0' }]),
      errors: [{ messageId: 'nonLiteral' }],
    },
  ],
})
