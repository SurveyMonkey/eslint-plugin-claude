// A `metadata` key that reuses the name of a frontmatter field. A `metadata` value that
// is not a map is a fault of `skill-frontmatter-schema`, so this rule skips it.
import { pluginCommand, pluginSkill } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const skill = '.claude/skills/s/SKILL.md'
const command = '.claude/commands/c.md'
const file = (fields: string, filename = skill) => ({
  code: `---\n${fields}---\n\n# S\n`,
  filename,
})

markdownTester.run('skill-metadata-reserved-keys', ruleOf('skill-metadata-reserved-keys'), {
  valid: [
    file('metadata:\n  team: web\n  owner: me\n'),
    file('metadata: {}\n'),
    file('description: d\n'),
    // A key is a frontmatter field only at the top level of `metadata`.
    file('metadata:\n  team:\n    paths: src\n'),
    // The match is exact.
    file('metadata:\n  Paths: src\n  path: src\n'),
    // A value that is not a map is a fault of the schema rule.
    file('metadata: paths\n'),
    file('metadata: [paths, name]\n'),
    file('metadata:\n'),
    file('metadata: null\n'),
    // A project command file has no `name` or `paths` field, so those are free keys there.
    file('metadata:\n  name: x\n  paths: src\n', command),
    // Not a skill or command file, no frontmatter, and frontmatter that does not parse.
    file('metadata:\n  paths: src\n', 'docs/SKILL.md'),
    { code: '# No frontmatter\n', filename: skill },
    file('metadata:\n  paths: src\n  bad: [\n'),
  ],
  invalid: [
    {
      ...file('metadata:\n  paths: src\n'),
      errors: [
        {
          // The message says no more than the docs.
          message:
            '`metadata` has `paths`. The docs say not to reuse a frontmatter field name as a key.',
          line: 3,
          column: 3,
          endLine: 3,
          endColumn: 13,
        },
      ],
    },
    // One report names every key.
    {
      ...file('name: s\nmetadata:\n  team: web\n  model: sonnet\n  description: d\n'),
      errors: [{ messageId: 'reserved', data: { keys: '`model`, `description`' } }],
    },
    // The key `metadata` is a frontmatter field too.
    {
      ...file('metadata: { metadata: 1 }\n'),
      errors: [{ messageId: 'reserved', data: { keys: '`metadata`' } }],
    },
    // Each field of the docs table is reserved.
    {
      ...file('metadata:\n  when_to_use: x\n  argument-hint: y\n  allowed-tools: z\n'),
      errors: [
        {
          messageId: 'reserved',
          data: { keys: '`when_to_use`, `argument-hint`, `allowed-tools`' },
        },
      ],
    },
    // A command file keeps the fields it has.
    {
      ...file('metadata:\n  model: x\n', command),
      errors: [{ messageId: 'reserved', data: { keys: '`model`' } }],
    },
    // A plugin command file takes `name` and `paths` as a skill does.
    {
      ...file('metadata:\n  name: x\n', pluginCommand()),
      errors: [{ messageId: 'reserved', data: { keys: '`name`' } }],
    },
    {
      ...file('metadata:\n  paths: x\n', pluginSkill()),
      errors: [{ messageId: 'reserved', data: { keys: '`paths`' } }],
    },
  ],
})
