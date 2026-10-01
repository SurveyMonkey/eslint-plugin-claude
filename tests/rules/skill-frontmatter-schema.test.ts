// Fixtures for each field type and enum of the Frontmatter reference, the
// near-miss keys, and the two fields that a command file does not take.
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const skill = '.claude/skills/s/SKILL.md'
const command = '.claude/commands/c.md'
const file = (fields: string, filename = skill) => ({
  code: `---\n${fields}---\n\n# S\n`,
  filename,
})

const all = [
  'name: s',
  'description: A skill.',
  'when_to_use: When asked.',
  'argument-hint: "[file]"',
  'arguments: [file, format]',
  'disable-model-invocation: true',
  'user-invocable: false',
  'allowed-tools: Read Grep',
  'disallowed-tools: [Bash]',
  'model: inherit',
  'effort: xhigh',
  'context: fork',
  'agent: Explore',
  'background: false',
  'hooks: {}',
  'paths: "src/**/*.ts, lib/**"',
  'shell: powershell',
  'metadata: { owner: web }',
  'license: MIT',
  'compatibility: Claude Code',
].join('\n')

markdownTester.run('skill-frontmatter-schema', ruleOf('skill-frontmatter-schema'), {
  valid: [
    file(`${all}\n`),
    file(
      `${all.replace('name: s\n', '').replace('paths: "src/**/*.ts, lib/**"\n', '')}\n`,
      command,
    ),
    // Each enum value.
    ...['low', 'medium', 'high', 'xhigh', 'max'].map((v) => file(`effort: ${v}\n`)),
    file('shell: bash\n'),
    // An empty value is an absent field.
    file('name:\ndescription:\nmetadata:\nmodel:\n'),
    // A string list and a comma string.
    file('allowed-tools: Bash(git add *), Read\n'),
    file('paths:\n  - src/**\n  - lib/**\n'),
    file(`compatibility: ${'a'.repeat(500)}\n`),
    file('model: claude-sonnet-5\n'),
    file('model: sonnet\n'),
    { code: '# No frontmatter\n', filename: skill },
    file('name: [unclosed\n'),
    // Not a skill or command file.
    file('made_up: 1\n', 'docs/SKILL.md'),
    file('made_up: 1\n', '.claude/agents/a.md'),
    // A `commands/` directory that is not in `.claude/` or a plugin.
    file('description: d\n', 'commands/c.md'),
  ],
  invalid: [
    {
      ...file('description: d\nmade_up: 1\n'),
      errors: [
        { messageId: 'unknownKey', data: { key: 'made_up' }, line: 3, column: 1, endColumn: 8 },
      ],
    },
    {
      ...file('allowed_tools: Read\n'),
      errors: [
        {
          messageId: 'nearMiss',
          data: { key: 'allowed_tools', expected: 'allowed-tools' },
          line: 2,
          suggestions: [
            {
              messageId: 'rename',
              data: { expected: 'allowed-tools' },
              output: '---\nallowed-tools: Read\n---\n\n# S\n',
            },
          ],
        },
      ],
    },
    {
      ...file('when-to-use: x\n'),
      errors: [
        {
          messageId: 'nearMiss',
          suggestions: [{ messageId: 'rename', output: '---\nwhen_to_use: x\n---\n\n# S\n' }],
        },
      ],
    },
    {
      ...file('"Disable-Model-Invocation": true\n'),
      errors: [
        {
          messageId: 'nearMiss',
          suggestions: [
            { messageId: 'rename', output: '---\ndisable-model-invocation: true\n---\n\n# S\n' },
          ],
        },
      ],
    },
    // A command file has no `name` or `paths`.
    {
      ...file('name: c\npaths: src/**\ndescription: d\n', command),
      errors: [
        { messageId: 'commandField', data: { key: 'name' }, line: 2 },
        { messageId: 'commandField', data: { key: 'paths' }, line: 3 },
      ],
    },
    // A near miss of a field that a command does not take is an unknown key.
    {
      ...file('Name: c\n', command),
      errors: [{ messageId: 'unknownKey', data: { key: 'Name' } }],
    },
    // Types.
    ...['name', 'description', 'argument-hint'].map((key) => ({
      ...file(`${key}: 3\n`),
      errors: [
        {
          messageId: 'wrongType' as const,
          data: { key, expected: 'a string' },
          line: 2,
          column: key.length + 3,
        },
      ],
    })),
    ...['arguments', 'allowed-tools', 'disallowed-tools', 'paths'].map((key) => ({
      ...file(`${key}: { a: 1 }\n`),
      errors: [{ messageId: 'wrongType' as const, data: { key, expected: 'a string or a list' } }],
    })),
    {
      ...file('allowed-tools: 3\n'),
      errors: [
        { messageId: 'wrongType', data: { key: 'allowed-tools', expected: 'a string or a list' } },
      ],
    },
    {
      ...file('metadata: [a, b]\n'),
      errors: [{ messageId: 'wrongType', data: { key: 'metadata', expected: 'a map' } }],
    },
    {
      ...file('metadata: text\n'),
      errors: [{ messageId: 'wrongType', data: { key: 'metadata', expected: 'a map' } }],
    },
    {
      ...file('compatibility: 3\n'),
      errors: [{ messageId: 'wrongType', data: { key: 'compatibility', expected: 'a string' } }],
    },
    {
      ...file(`compatibility: ${'a'.repeat(501)}\n`),
      errors: [{ messageId: 'tooLong', data: { length: '501', max: '500' } }],
    },
    {
      ...file('model: 5\n'),
      errors: [{ messageId: 'wrongType', data: { key: 'model', expected: 'a non-empty string' } }],
    },
    {
      ...file('model: " "\n'),
      errors: [{ messageId: 'wrongType', data: { key: 'model', expected: 'a non-empty string' } }],
    },
    // Enums.
    {
      ...file('effort: extreme\n'),
      errors: [
        {
          messageId: 'invalidValue',
          data: { key: 'effort', allowed: '`low`, `medium`, `high`, `xhigh`, `max`' },
        },
      ],
    },
    {
      ...file('effort: 3\n'),
      errors: [
        {
          messageId: 'invalidValue',
          data: { key: 'effort', allowed: '`low`, `medium`, `high`, `xhigh`, `max`' },
        },
      ],
    },
    {
      ...file('context: inline\n'),
      errors: [{ messageId: 'invalidValue', data: { key: 'context', allowed: '`fork`' } }],
    },
    {
      ...file('shell: zsh\n'),
      errors: [
        { messageId: 'invalidValue', data: { key: 'shell', allowed: '`bash`, `powershell`' } },
      ],
    },
  ],
})
