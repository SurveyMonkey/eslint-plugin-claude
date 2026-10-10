// The output styles page, "Frontmatter reference": `force-for-plugin: true`
// applies the style whenever the plugin is enabled and overrides the
// `outputStyle` setting of the user. The field works in a plugin style only.
// `output-style-frontmatter-schema` reports it in a local style.
import { pluginStyle } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const local = '.claude/output-styles/s.md'
const file = (value: string, filename = pluginStyle()) => ({
  code: `---\nname: s\ndescription: d\nforce-for-plugin: ${value}\n---\n\nBody.\n`,
  filename,
})

markdownTester.run('output-style-force-for-plugin', ruleOf('output-style-force-for-plugin'), {
  valid: [
    file('false'),
    file('no'),
    file('0'),
    // A value that is no Boolean is for `output-style-frontmatter-schema`.
    file('maybe'),
    file('[true]'),
    file('2'),
    // A local style: the schema rule reports the field.
    file('true', local),
    // No field, an empty field, bad YAML, and a file outside the folders.
    { code: '---\nname: s\n---\n', filename: pluginStyle() },
    { code: '---\nforce-for-plugin:\n---\n', filename: pluginStyle() },
    { code: '---\nforce-for-plugin: [true\n---\n', filename: pluginStyle() },
    { code: 'force-for-plugin: true\n', filename: pluginStyle() },
    file('true', 'docs/s.md'),
    // A subfolder of `output-styles/` is not read.
    file('true', pluginStyle().replace('output-styles/', 'output-styles/sub/')),
  ],
  invalid: [
    {
      ...file('true'),
      errors: [{ messageId: 'forced', line: 4, column: 19, endLine: 4, endColumn: 23 }],
    },
    // The docs show `true`. Claude Code reads the same Boolean forms as for other fields, by inference.
    ...['yes', 'on', '1', 'TRUE', '"true"'].map((value) => ({
      ...file(value),
      errors: [{ messageId: 'forced' as const }],
    })),
  ],
})
