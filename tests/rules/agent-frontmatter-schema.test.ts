// Fixtures for each field type and enum of the Frontmatter reference, the
// near-miss keys, and the `experimental` map. The rule reads local and plugin
// agents.
import { pluginAgent } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const local = '.claude/agents/a.md'
const file = (fields: string, filename = local) => ({
  code: `---\n${fields}---\n\nBody.\n`,
  filename,
})

const all = [
  'name: a',
  'description: A subagent.',
  'tools: Read, Grep',
  'disallowedTools: [Bash]',
  'model: sonnet',
  'permissionMode: acceptEdits',
  'maxTurns: 5',
  'skills: [deploy]',
  'mcpServers: [github]',
  'hooks: {}',
  'memory: project',
  'background: false',
  'omitClaudeMd: true',
  'effort: xhigh',
  'isolation: worktree',
  'color: cyan',
  'initialPrompt: Go',
  'experimental: { cacheTtl: 1h }',
].join('\n')

const wrong = (key: string, expected: string) => ({
  messageId: 'wrongType',
  data: { key, expected },
})

markdownTester.run('agent-frontmatter-schema', ruleOf('agent-frontmatter-schema'), {
  valid: [
    file(`${all}\n`),
    file(`${all}\n`, pluginAgent()),
    file(`${all}\n`, '.claude/agents/review/b.md'),
    ...['default', 'acceptEdits', 'auto', 'dontAsk', 'bypassPermissions', 'plan', 'manual'].map(
      (v) => file(`permissionMode: ${v}\n`),
    ),
    ...['user', 'project', 'local'].map((v) => file(`memory: ${v}\n`)),
    ...['low', 'medium', 'high', 'xhigh', 'max'].map((v) => file(`effort: ${v}\n`)),
    ...['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'].map((v) =>
      file(`color: ${v}\n`),
    ),
    file('experimental: { cacheTtl: 5m }\n'),
    file('experimental: {}\n'),
    file('experimental: { cacheTtl: }\n'),
    // A model alias and a full id are strings.
    file('model: claude-opus-5-5\n'),
    file('model: inherit\n'),
    // A comma string and a list for `tools`.
    file('tools: Bash(git add *), Read\ndisallowedTools: Write\n'),
    // The Boolean forms of the skills reference.
    ...['yes', 'No', 'ON', 'off', '1', '0', 'true'].map((v) => file(`background: ${v}\n`)),
    // An empty value is an absent field.
    file('name:\ndescription:\ntools:\nmaxTurns:\nexperimental:\n'),
    { code: '# No frontmatter\n', filename: local },
    file('name: [unclosed\n'),
    // Not an agent file.
    file('made_up: 1\n', 'docs/agents/a.md'),
    file('made_up: 1\n', '.claude/skills/s/SKILL.md'),
  ],
  invalid: [
    {
      ...file('description: d\nmade_up: 1\n'),
      errors: [
        { messageId: 'unknownKey', data: { key: 'made_up' }, line: 3, column: 1, endColumn: 8 },
      ],
    },
    {
      ...file('max_turns: 3\n'),
      errors: [
        {
          messageId: 'nearMiss',
          data: { key: 'max_turns', expected: 'maxTurns' },
          line: 2,
          suggestions: [
            {
              messageId: 'rename',
              data: { expected: 'maxTurns' },
              output: '---\nmaxTurns: 3\n---\n\nBody.\n',
            },
          ],
        },
      ],
    },
    {
      ...file('disallowed-tools: Bash\n', pluginAgent()),
      errors: [
        {
          messageId: 'nearMiss',
          suggestions: [
            {
              messageId: 'rename',
              output: '---\ndisallowedTools: Bash\n---\n\nBody.\n',
            },
          ],
        },
      ],
    },
    // The docs say to write `cacheTtl` inside `experimental`.
    {
      ...file('cacheTtl: 1h\n'),
      errors: [{ messageId: 'cacheTtlTopLevel', line: 2, column: 1, endColumn: 9 }],
    },
    { ...file('name: [a]\n'), errors: [wrong('name', 'a string')] },
    { ...file('description: 5\n'), errors: [wrong('description', 'a string')] },
    {
      ...file('tools: 5\n'),
      errors: [wrong('tools', 'a comma-separated string or a list of strings')],
    },
    {
      ...file('disallowedTools: [Bash, 5]\n'),
      errors: [wrong('disallowedTools', 'a comma-separated string or a list of strings')],
    },
    { ...file('model: [a]\n'), errors: [wrong('model', 'a non-empty string')] },
    { ...file('model: " "\n'), errors: [wrong('model', 'a non-empty string')] },
    ...['abc', '0', '-1', '1.5'].map((v) => ({
      ...file(`maxTurns: ${v}\n`),
      errors: [wrong('maxTurns', 'a positive integer')],
    })),
    { ...file('skills: deploy\n'), errors: [wrong('skills', 'a list of skill names')] },
    { ...file('skills: [a, 5]\n'), errors: [wrong('skills', 'a list of skill names')] },
    { ...file('background: maybe\n'), errors: [wrong('background', 'a Boolean')] },
    { ...file('omitClaudeMd: 2\n'), errors: [wrong('omitClaudeMd', 'a Boolean')] },
    { ...file('experimental: true\n'), errors: [wrong('experimental', 'a map')] },
    { ...file('experimental: [a]\n'), errors: [wrong('experimental', 'a map')] },
    {
      ...file('experimental: { cacheTtl: 2h }\n'),
      errors: [
        {
          messageId: 'invalidValue',
          data: { key: 'experimental.cacheTtl', allowed: '`5m`, `1h`' },
          line: 2,
        },
      ],
    },
    {
      ...file('experimental: { other: 1 }\n'),
      errors: [{ messageId: 'unknownExperimental', data: { key: 'other' } }],
    },
    {
      ...file('permissionMode: always\n'),
      errors: [
        {
          messageId: 'invalidValue',
          data: {
            key: 'permissionMode',
            allowed:
              '`default`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan`, `manual`',
          },
          line: 2,
          column: 17,
          endColumn: 23,
        },
      ],
    },
    {
      ...file('memory: team\n'),
      errors: [
        {
          messageId: 'invalidValue',
          data: { key: 'memory', allowed: '`user`, `project`, `local`' },
        },
      ],
    },
    {
      ...file('effort: 5\n'),
      errors: [
        {
          messageId: 'invalidValue',
          data: { key: 'effort', allowed: '`low`, `medium`, `high`, `xhigh`, `max`' },
        },
      ],
    },
    {
      ...file('isolation: container\n'),
      errors: [{ messageId: 'invalidValue', data: { key: 'isolation', allowed: '`worktree`' } }],
    },
    {
      ...file('color: teal\n'),
      errors: [
        {
          messageId: 'invalidValue',
          data: {
            key: 'color',
            allowed: '`red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, `cyan`',
          },
        },
      ],
    },
  ],
})
