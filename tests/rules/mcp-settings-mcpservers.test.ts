// Claude Code reads no `mcpServers` key from a settings file. The debug page says so in the table
// "Check common causes". The files glob is in tests/configs.test.ts.
import { json5Tester, jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('mcp-settings-mcpservers')

const project = '.claude/settings.json'
const local = '.claude/settings.local.json'
const servers = { memory: { command: 'npx', args: ['-y', 'mcp-memory'] } }

jsonTester.run('mcp-settings-mcpservers (valid)', rule, {
  valid: [
    { name: 'no such key', code: JSON.stringify({ model: 'opus' }), filename: project },
    { name: 'empty object', code: '{}', filename: local },
    { name: 'array body', code: '[]', filename: project },
    { name: 'string body', code: '"mcpServers"', filename: project },
    // The approval keys are real settings keys that name servers of `.mcp.json`.
    {
      name: 'the approval keys',
      code: JSON.stringify({ enabledMcpjsonServers: ['memory'], disabledMcpjsonServers: [] }),
      filename: project,
    },
    // The key is read at the top level only.
    {
      name: 'a nested key',
      code: JSON.stringify({ env: { mcpServers: 'x' }, permissions: { mcpServers: [] } }),
      filename: project,
    },
    // A near miss of the key name.
    { name: 'mcpserver', code: JSON.stringify({ mcpserver: servers }), filename: project },
    { name: 'managedMcpServers', code: JSON.stringify({ managedMcpServers: {} }), filename: local },
  ],
  invalid: [],
})

jsonTester.run('mcp-settings-mcpservers (invalid)', rule, {
  valid: [],
  invalid: [
    {
      name: 'project file, with the position of the key',
      code: JSON.stringify({ mcpServers: servers }),
      filename: project,
      errors: [{ messageId: 'unread', line: 1, column: 2, endColumn: 14 }],
    },
    {
      name: 'local file',
      code: JSON.stringify({ model: 'opus', mcpServers: servers }),
      filename: local,
      errors: [{ messageId: 'unread', line: 1, column: 17 }],
    },
    {
      name: 'any value',
      code: JSON.stringify({ mcpServers: {} }),
      filename: project,
      errors: [{ messageId: 'unread' }],
    },
    ...[null, 'x', 1, [], true].map((value) => ({
      name: `value ${JSON.stringify(value)}`,
      code: JSON.stringify({ mcpServers: value }),
      filename: project,
      errors: [{ messageId: 'unread' as const }],
    })),
    {
      name: 'a nested directory',
      code: JSON.stringify({ mcpServers: servers }),
      filename: 'packages/app/.claude/settings.json',
      errors: [{ messageId: 'unread' }],
    },
    // Two keys of one name give one report, on the last.
    {
      name: 'duplicate key',
      code: '{"mcpServers": {}, "mcpServers": {}}',
      filename: project,
      errors: [{ messageId: 'unread', column: 20 }],
    },
  ],
})

json5Tester.run('mcp-settings-mcpservers (JSON5 invalid)', rule, {
  valid: [],
  invalid: [
    {
      code: '{ mcpServers: {} }',
      filename: project,
      errors: [{ messageId: 'unread' }],
    },
  ],
})

// The text of the message.
jsonTester.run('mcp-settings-mcpservers (message text)', rule, {
  valid: [],
  invalid: [
    {
      code: JSON.stringify({ mcpServers: servers }),
      filename: project,
      errors: [
        {
          message:
            'Claude Code does not read an "mcpServers" key in a settings file, so these servers never appear. Define project servers in .mcp.json at the repository root, or run `claude mcp add --scope user`.',
        },
      ],
    },
  ],
})
