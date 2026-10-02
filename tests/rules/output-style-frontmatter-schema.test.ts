// The four fields of an output style, in kebab-case. `force-for-plugin` works
// only in a plugin style.
import { pluginStyle } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const local = '.claude/output-styles/s.md'
const file = (fields: string, filename = local) => ({
  code: `---\n${fields}---\n\nAnswer in rhyme.\n`,
  filename,
})

markdownTester.run('output-style-frontmatter-schema', ruleOf('output-style-frontmatter-schema'), {
  valid: [
    file('name: Rhyme\ndescription: Answers in rhyme.\nkeep-coding-instructions: true\n'),
    file('name: Rhyme\nforce-for-plugin: true\nkeep-coding-instructions: false\n', pluginStyle()),
    ...['yes', 'No', 'ON', 'off', '1', '0'].map((v) => file(`keep-coding-instructions: ${v}\n`)),
    // A quoted form is a string, and the forms are read as strings too.
    ...['"true"', '"False"', '"yes"', '"On"', '"1"', '"0"'].map((v) =>
      file(`keep-coding-instructions: ${v}\n`),
    ),
    // An empty value is an absent field.
    file('name:\ndescription:\nkeep-coding-instructions:\n'),
    // A local style with no `force-for-plugin` value is not a fault of the value.
    { code: 'No frontmatter.\n', filename: local },
    file('name: [unclosed\n'),
    file('made_up: 1\n', 'docs/output-styles/s.md'),
  ],
  invalid: [
    {
      ...file('name: Rhyme\nmade_up: 1\n'),
      errors: [
        { messageId: 'unknownKey', data: { key: 'made_up' }, line: 3, column: 1, endColumn: 8 },
      ],
    },
    {
      ...file('keepCodingInstructions: true\n', pluginStyle()),
      errors: [
        {
          messageId: 'nearMiss',
          data: { key: 'keepCodingInstructions', expected: 'keep-coding-instructions' },
          line: 2,
          suggestions: [
            {
              messageId: 'rename',
              data: { expected: 'keep-coding-instructions' },
              output: '---\nkeep-coding-instructions: true\n---\n\nAnswer in rhyme.\n',
            },
          ],
        },
      ],
    },
    {
      ...file('force-for-plugin: true\n'),
      errors: [{ messageId: 'pluginOnly', line: 2, column: 1, endColumn: 17 }],
    },
    // A local style also gets the type check on the value.
    {
      ...file('force-for-plugin: maybe\n'),
      errors: [
        { messageId: 'pluginOnly' },
        { messageId: 'wrongType', data: { key: 'force-for-plugin', expected: 'a Boolean' } },
      ],
    },
    {
      ...file('name: [a]\ndescription: 5\n'),
      errors: [
        { messageId: 'wrongType', data: { key: 'name', expected: 'a string' } },
        { messageId: 'wrongType', data: { key: 'description', expected: 'a string' } },
      ],
    },
    {
      ...file('keep-coding-instructions: maybe\n', pluginStyle()),
      errors: [
        {
          messageId: 'wrongType',
          data: { key: 'keep-coding-instructions', expected: 'a Boolean' },
          line: 2,
          column: 27,
          endColumn: 32,
        },
      ],
    },
  ],
})
