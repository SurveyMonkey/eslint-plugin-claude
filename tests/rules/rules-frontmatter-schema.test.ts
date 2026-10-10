// A rule file reads one frontmatter field, `paths`, as a YAML list or a comma-separated string
// (https://code.claude.com/docs/en/memory#rules-frontmatter-reference). Claude Code ignores any
// other field, ignores frontmatter that does not parse, and reads frontmatter only on line 1.
// The files glob is in tests/configs.test.ts.
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('rules-frontmatter-schema')

const filename = '.claude/rules/testing.md'
const body = '\n# Testing\n\n- Use vitest\n'
const rulefile = (frontmatter: string, name = filename) => ({
  code: `---\n${frontmatter}\n---\n${body}`,
  filename: name,
})
const unknownKey = (key: string) => ({ messageId: 'unknownKey' as const, data: { key } })
const wrongType = { messageId: 'wrongType' as const }

markdownTester.run('rules-frontmatter-schema', rule, {
  valid: [
    // The examples of the docs.
    rulefile('paths:\n  - "src/api/**/*.ts"'),
    rulefile('paths:\n  - "src/**/*.{ts,tsx}"\n  - "lib/**/*.ts"\n  - "tests/**/*.test.ts"'),
    rulefile('paths: "src/api/**/*.ts, lib/**/*.ts"'),
    rulefile('paths: src/api/*.ts, lib/*.ts'),
    rulefile('paths: []'),
    rulefile('paths: ""'),
    // An empty value is the same as an absent field.
    rulefile('paths:'),
    rulefile('paths: ~'),
    // No frontmatter, and an empty block.
    { code: '# Testing\n', filename },
    { code: '---\n---\n# Testing\n', filename },
    { code: '---\n  \n---\n# Testing\n', filename },
    // A block of comments only sets no field, as an empty block does not.
    { code: '---\n# note\n\n  # more\n---\n# Testing\n', filename },
    // A horizontal rule and prose that are not frontmatter.
    { code: '# Testing\n\n---\n\nText\n\n---\n', filename },
    { code: '# Testing\n\n---\nname: a\n---\n', filename },
    // A rule file in a subdirectory, a user-level path, and a nested `.claude`.
    rulefile('paths: "src/**"', '.claude/rules/frontend/react.md'),
    rulefile('paths: "src/**"', '/home/user/.claude/rules/prefs.md'),
    rulefile('paths: "src/**"', 'packages/web/.claude/rules/a.md'),
    // A file that is not a rule file is not read, even with a fault.
    rulefile('globs: "*.ts"', 'docs/rules/a.md'),
    rulefile('globs: "*.ts"', '.claude/skills/rules/a.md'),
    rulefile('globs: "*.ts"', 'CLAUDE.md'),
    rulefile('globs: "*.ts"', 'docs/CLAUDE-notes.md'),
    // The frontmatter of a rule file that is lower than line 1 holds no `paths`.
    { code: '\n---\nname: a\n---\n', filename },
  ],
  invalid: [
    // A key other than `paths`: Claude Code ignores it with no error.
    {
      ...rulefile('globs: "*.ts"'),
      errors: [{ ...unknownKey('globs'), line: 2, column: 1, endLine: 2, endColumn: 6 }],
    },
    { ...rulefile('description: Testing rules'), errors: [unknownKey('description')] },
    { ...rulefile('Paths: "src/**"'), errors: [unknownKey('Paths')] },
    {
      ...rulefile('alwaysApply: true\nglobs: "*.ts"'),
      errors: [unknownKey('alwaysApply'), unknownKey('globs')],
    },
    // One good key and one bad key.
    { ...rulefile('paths: "src/**"\nname: testing'), errors: [unknownKey('name')] },
    // `paths` of the wrong type.
    { ...rulefile('paths: 3'), errors: [{ ...wrongType, line: 2, column: 8, endColumn: 9 }] },
    { ...rulefile('paths: true'), errors: [wrongType] },
    { ...rulefile('paths:\n  glob: "src/**"'), errors: [wrongType] },
    { ...rulefile('paths:\n  - "src/**"\n  - 3'), errors: [wrongType] },
    { ...rulefile('paths:\n  - "src/**"\n  -'), errors: [wrongType] },
    { ...rulefile('paths:\n  - ["src/**"]'), errors: [wrongType] },
    // The YAML does not parse. A glob that starts with `*` is an alias in YAML.
    { ...rulefile('paths: *.ts'), errors: [{ messageId: 'invalidYaml', line: 1, column: 1 }] },
    { ...rulefile('paths:\n  - **/*.ts'), errors: [{ messageId: 'invalidYaml' }] },
    { ...rulefile('paths: [unclosed'), errors: [{ messageId: 'invalidYaml' }] },
    { ...rulefile('paths: "src"\npaths: "lib"'), errors: [{ messageId: 'invalidYaml' }] },
    // YAML that parses to something that is not a map of fields.
    { ...rulefile('- src/**'), errors: [{ messageId: 'invalidYaml' }] },
    { ...rulefile('just text'), errors: [{ messageId: 'invalidYaml' }] },
    // The block is not on line 1, so Claude Code reads it as rule text.
    {
      code: '\n---\npaths:\n  - "src/**"\n---\n# Testing\n',
      filename,
      errors: [{ messageId: 'notFirst', line: 2, column: 1, endColumn: 4 }],
    },
    {
      code: '# Testing\n\n---\npaths: "src/**"\n---\n',
      filename,
      errors: [{ messageId: 'notFirst', line: 3 }],
    },
    // A rule file at each depth.
    { ...rulefile('globs: x', '.claude/rules/frontend/react.md'), errors: [unknownKey('globs')] },
    { ...rulefile('globs: x', 'packages/web/.claude/rules/a.md'), errors: [unknownKey('globs')] },
  ],
})

// The text of each message.
markdownTester.run('rules-frontmatter-schema (message text)', rule, {
  valid: [],
  invalid: [
    {
      ...rulefile('globs: x'),
      errors: [
        {
          message:
            '`globs` is not a rule frontmatter field. Claude Code ignores it. The only field is `paths`.',
        },
      ],
    },
    {
      ...rulefile('paths: 3'),
      errors: [{ message: '`paths` must be a list of strings or one comma-separated string.' }],
    },
    {
      ...rulefile('paths: *.ts'),
      errors: [
        {
          message:
            'The frontmatter is not YAML that gives a map of fields. Claude Code ignores it, and loads the rule with no `paths`. A glob that starts with `*` needs quotes.',
        },
      ],
    },
    {
      code: '\n---\npaths: "src/**"\n---\n',
      filename,
      errors: [
        {
          message:
            'This frontmatter block does not start on line 1. Claude Code reads it as rule text, and sets no `paths`.',
        },
      ],
    },
  ],
})
