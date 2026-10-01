// The rule checks local agents only. A plugin agent ignores `mcpServers`, and
// `agent-plugin-ignored-fields` reports it there.
import { pluginAgent } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const local = '.claude/agents/a.md'
const file = (frontmatter: string, filename = local) => ({
  code: `---\nname: a\ndescription: d\n${frontmatter}---\n\nBody.\n`,
  filename,
})

markdownTester.run('agent-mcp-servers-schema', ruleOf('agent-mcp-servers-schema'), {
  valid: [
    // The docs example: an inline server and a name.
    file(
      'mcpServers:\n  - playwright:\n      type: stdio\n      command: npx\n      args: ["-y", "@playwright/mcp@latest"]\n  - github\n',
    ),
    file('mcpServers: [github, slack]\n'),
    ...['stdio', 'http', 'sse', 'ws'].map((type) =>
      file(`mcpServers:\n  - remote:\n      type: ${type}\n      url: https://example.com\n`),
    ),
    // Claude Code skips an `sdk` server with a warning. It is not a schema fault.
    file('mcpServers:\n  - app:\n      type: sdk\n'),
    // A server config with no `type`.
    file('mcpServers:\n  - db:\n      command: node\n'),
    file('mcpServers: []\n'),
    file('mcpServers:\n'),
    file('model: sonnet\n'),
    file('mcpServers: github\n', pluginAgent()),
    file('mcpServers: github\n', 'docs/agents/a.md'),
    file('mcpServers: [unclosed\n'),
  ],
  invalid: [
    {
      ...file('mcpServers: github\n'),
      errors: [{ messageId: 'notList', line: 4, column: 13, endColumn: 19 }],
    },
    {
      ...file('mcpServers:\n  github: {}\n'),
      errors: [{ messageId: 'notList' }],
    },
    {
      ...file('mcpServers:\n  - github\n  - 5\n'),
      errors: [{ messageId: 'badEntry', data: { index: '1' } }],
    },
    {
      ...file('mcpServers:\n  - a:\n      command: x\n    b:\n      command: y\n'),
      errors: [{ messageId: 'badEntry', data: { index: '0' } }],
    },
    {
      ...file('mcpServers:\n  - {}\n  - [x]\n'),
      errors: [
        { messageId: 'badEntry', data: { index: '0' } },
        { messageId: 'badEntry', data: { index: '1' } },
      ],
    },
    {
      ...file('mcpServers:\n  - db: node\n'),
      errors: [{ messageId: 'badConfig', data: { server: 'db' } }],
    },
    {
      ...file('mcpServers:\n  - db:\n'),
      errors: [{ messageId: 'badConfig', data: { server: 'db' } }],
    },
    {
      ...file('mcpServers:\n  - db:\n      type: grpc\n'),
      errors: [{ messageId: 'badType', data: { server: 'db', type: 'grpc' } }],
    },
    {
      ...file('mcpServers:\n  - db:\n      type: 5\n'),
      errors: [{ messageId: 'badType', data: { server: 'db', type: '5' } }],
    },
  ],
})
