// An output style file has no required field, so a file with no frontmatter is
// valid. The rule reports a block that does not parse, and a block below line 1.
import { pluginStyle } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const local = '.claude/output-styles/s.md'
const file = (frontmatter: string, filename = local) => ({
  code: `---\n${frontmatter}---\n\nAnswer in rhyme.\n`,
  filename,
})

markdownTester.run('output-style-frontmatter-valid', ruleOf('output-style-frontmatter-valid'), {
  valid: [
    file('name: Rhyme\ndescription: Answers in rhyme.\nkeep-coding-instructions: true\n'),
    file('name: Rhyme\n', pluginStyle()),
    // No frontmatter, and an empty block, set no field. Both are valid.
    { code: 'Answer in rhyme.\n', filename: local },
    { code: '---\n---\n\nAnswer in rhyme.\n', filename: local },
    // A horizontal rule, and a late block with no style field.
    { code: 'Intro.\n\n---\n\nMore.\n\n---\n', filename: local },
    { code: 'Intro.\n\n---\nowner: web\n---\n', filename: local },
    file('name: [unclosed\n', '.claude/output-styles/nested/s.md'),
    file('name: [unclosed\n', 'docs/output-styles/s.md'),
    file('name: [unclosed\n', '.claude/other/s.md'),
  ],
  invalid: [
    {
      ...file('name: [unclosed\n'),
      errors: [{ messageId: 'invalidYaml', line: 1 }],
    },
    {
      ...file('name: [unclosed\n', pluginStyle()),
      errors: [{ messageId: 'invalidYaml' }],
    },
    {
      ...file('just text\n'),
      errors: [{ messageId: 'invalidYaml' }],
    },
    {
      code: '\n---\nname: Rhyme\n---\n\nAnswer in rhyme.\n',
      filename: local,
      errors: [{ messageId: 'notFirst', line: 2, column: 1, endColumn: 4 }],
    },
    {
      code: 'Intro.\n\n---\nkeep-coding-instructions: true\n---\n',
      filename: pluginStyle(),
      errors: [{ messageId: 'notFirst', line: 3 }],
    },
  ],
})
