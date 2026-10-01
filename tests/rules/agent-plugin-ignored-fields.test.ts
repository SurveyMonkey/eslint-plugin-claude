// The rule checks plugin agents only. A local agent can set each of the four
// fields.
import { pluginAgent } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const file = (frontmatter: string, filename = pluginAgent()) => ({
  code: `---\nname: a\ndescription: d\n${frontmatter}---\n\nBody.\n`,
  filename,
})

markdownTester.run('agent-plugin-ignored-fields', ruleOf('agent-plugin-ignored-fields'), {
  valid: [
    file('model: sonnet\nmemory: project\n'),
    // A local agent uses each field.
    file(
      'permissionMode: plan\nhooks: {}\nmcpServers: [github]\ninitialPrompt: Go\n',
      '.claude/agents/a.md',
    ),
    // Not an agent file.
    file('permissionMode: plan\n', 'docs/agents/a.md'),
    // Frontmatter that does not parse.
    file('hooks: [unclosed\n'),
  ],
  invalid: [
    {
      ...file('permissionMode: plan\n'),
      errors: [
        {
          messageId: 'ignored',
          data: {
            key: 'permissionMode',
            advice: 'Copy the agent to `.claude/agents/` if it needs this field.',
          },
          line: 4,
          column: 1,
          endColumn: 15,
        },
      ],
    },
    {
      ...file('hooks:\n  Stop: []\n'),
      errors: [
        {
          messageId: 'ignored',
          data: { key: 'hooks', advice: 'Declare the hooks in `hooks/hooks.json` of the plugin.' },
        },
      ],
    },
    {
      ...file('mcpServers:\n  - github\n'),
      errors: [
        {
          messageId: 'ignored',
          data: { key: 'mcpServers', advice: 'Declare the servers in `.mcp.json` of the plugin.' },
        },
      ],
    },
    {
      ...file('initialPrompt: Go\n'),
      errors: [
        { messageId: 'ignored', data: { key: 'initialPrompt', advice: 'Remove the field.' } },
      ],
    },
    {
      ...file('permissionMode: plan\ninitialPrompt: Go\nmodel: sonnet\n', pluginAgent('x')),
      errors: [{ messageId: 'ignored' }, { messageId: 'ignored' }],
    },
  ],
})
