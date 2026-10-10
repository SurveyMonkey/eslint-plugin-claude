// The sub-agents page, "Trust required for inline MCP servers": Claude Code
// loads an inline server from an agent file in `.claude/agents/` only after
// you trust the folder the file came from. A name that references a server
// loads with no check. The `mcpServers` field is ignored in a plugin agent.
import { pluginAgent } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const local = '.claude/agents/a.md'
const file = (fields: string, filename = local) => ({
  code: `---\nname: a\ndescription: d\n${fields}---\n\nBody.\n`,
  filename,
})

// The shape of the docs example: one inline server, and one name reference.
const PLAYWRIGHT =
  'mcpServers:\n  - playwright:\n      type: stdio\n      command: npx\n      args: ["-y", "@playwright/mcp@latest"]\n  - github\n'

markdownTester.run('agent-mcp-servers-inline-trust', ruleOf('agent-mcp-servers-inline-trust'), {
  valid: [
    // A name that references a server needs no trust.
    file('mcpServers:\n  - github\n  - slack\n'),
    // A plugin agent ignores the field.
    file(PLAYWRIGHT, pluginAgent()),
    // No inline server: no field, no value, an empty list.
    file(''),
    file('mcpServers:\n'),
    file('mcpServers: []\n'),
    // A shape that is no inline definition is for agent-mcp-servers-schema.
    file('mcpServers: github\n'),
    file('mcpServers:\n  - playwright: npx\n'),
    file('mcpServers:\n  - [a]\n  - 5\n'),
    file('mcpServers:\n  a: {command: x}\n'),
    { code: '# No frontmatter\n', filename: local },
    { code: '---\nname: [unclosed\n---\n', filename: local },
    file(PLAYWRIGHT, 'docs/a.md'),
  ],
  invalid: [
    {
      ...file(PLAYWRIGHT),
      errors: [
        {
          messageId: 'trust',
          data: { servers: 'playwright' },
          line: 5,
          column: 3,
          endLine: 9,
        },
      ],
    },
    // Each inline server is named in one report.
    {
      ...file(
        'mcpServers:\n  - a:\n      command: x\n  - github\n  - b:\n      type: http\n      url: https://x.test\n',
      ),
      errors: [{ messageId: 'trust', data: { servers: 'a, b' } }],
    },
    // A map entry with two keys lists both servers.
    {
      ...file('mcpServers:\n  - a: {command: x}\n    b: {command: y}\n'),
      errors: [{ messageId: 'trust', data: { servers: 'a, b' } }],
    },
    // An agent in a subfolder is a project agent too.
    {
      ...file('mcpServers:\n  - a: {command: x}\n', '.claude/agents/team/a.md'),
      errors: [{ messageId: 'trust', data: { servers: 'a' } }],
    },
    // A nested project directory has its own `.claude/agents/`.
    {
      ...file('mcpServers:\n  - a: {command: x}\n', 'packages/x/.claude/agents/a.md'),
      errors: [{ messageId: 'trust', data: { servers: 'a' } }],
    },
  ],
})
