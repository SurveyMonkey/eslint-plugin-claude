// The plugin components page, "Themes and output styles": a plugin output
// style is a style file "with `name` and `description` frontmatter". A style
// without them loads under its file name, with no description.
import { pluginStyle } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const local = '.claude/output-styles/s.md'
const style = (fields: string) => `---\n${fields}---\n\nBody.\n`
const file = (fields: string, filename = pluginStyle()) => ({ code: style(fields), filename })

markdownTester.run(
  'output-style-plugin-name-description',
  ruleOf('output-style-plugin-name-description'),
  {
    valid: [
      file('name: s\ndescription: d\n'),
      file('name: s\ndescription: d\nkeep-coding-instructions: true\n'),
      // A value of another type is for `output-style-frontmatter-schema`.
      file('name: 1\ndescription: [d]\n'),
      file('name: s\ndescription: 0\n'),
      // A local style: the docs ask for the fields in a plugin style.
      file('', local),
      { code: 'Body.\n', filename: local },
      // Frontmatter that does not parse is for `output-style-frontmatter-valid`.
      file('name: [unclosed\n'),
      // So is a block that is not on line 1.
      { code: '\n---\nname: s\ndescription: d\n---\n', filename: pluginStyle() },
      { code: 'Body.\n\n---\nname: s\n---\n', filename: pluginStyle() },
      file('name: s\ndescription: d\n', 'docs/s.md'),
      file(
        'name: s\ndescription: d\n',
        pluginStyle().replace('output-styles/', 'output-styles/sub/'),
      ),
    ],
    invalid: [
      {
        ...file('description: d\n'),
        errors: [{ messageId: 'missing', data: { fields: '`name`' }, line: 1, endLine: 3 }],
      },
      {
        ...file('name: s\n'),
        errors: [{ messageId: 'missing', data: { fields: '`description`' } }],
      },
      {
        ...file('keep-coding-instructions: true\n'),
        errors: [{ messageId: 'missing', data: { fields: '`name` or `description`' } }],
      },
      // An empty value, a blank string and a null value set nothing.
      {
        ...file('name:\ndescription: d\n'),
        errors: [{ messageId: 'missing', data: { fields: '`name`' } }],
      },
      {
        ...file('name: "  "\ndescription: d\n'),
        errors: [{ messageId: 'missing', data: { fields: '`name`' } }],
      },
      {
        ...file('name: s\ndescription: ""\n'),
        errors: [{ messageId: 'missing', data: { fields: '`description`' } }],
      },
      // Empty frontmatter, and no frontmatter at all.
      {
        ...file(''),
        errors: [{ messageId: 'missing', data: { fields: '`name` or `description`' } }],
      },
      {
        code: 'Body.\n',
        filename: pluginStyle(),
        errors: [
          {
            messageId: 'missing',
            data: { fields: '`name` or `description`' },
            line: 1,
            column: 1,
            endLine: 1,
            endColumn: 1,
          },
        ],
      },
      // A fenced block in the body is no frontmatter.
      {
        code: '```\n---\nname: s\n---\n```\n',
        filename: pluginStyle(),
        errors: [{ messageId: 'missing' }],
      },
    ],
  },
)
