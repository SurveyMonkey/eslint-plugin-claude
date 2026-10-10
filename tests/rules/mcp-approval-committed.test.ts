// A committed `.claude/settings.json` that approves the servers of `.mcp.json`. The settings
// reference gives both keys. The MCP page describes the effect in "Project server approvals and
// workspace trust". Claude Code writes the keys to `.claude/settings.local.json`, which the rule
// does not read. The files glob is in tests/configs.test.ts.
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('mcp-approval-committed')

const project = '.claude/settings.json'
const local = '.claude/settings.local.json'
const all = (value: unknown) => JSON.stringify({ enableAllProjectMcpServers: value })
const listed = (value: unknown) => JSON.stringify({ enabledMcpjsonServers: value })

jsonTester.run('mcp-approval-committed (valid)', rule, {
  valid: [
    { name: 'no key', code: JSON.stringify({ model: 'opus' }), filename: project },
    { name: 'array body', code: '[]', filename: project },
    // The local file is not committed, and Claude Code writes the keys there.
    { name: 'all, local file', code: all(true), filename: local },
    { name: 'listed, local file', code: listed(['memory']), filename: local },
    // A value that approves nothing.
    { name: 'all is false', code: all(false), filename: project },
    { name: 'all is a string', code: all('true'), filename: project },
    { name: 'all is a number', code: all(1), filename: project },
    { name: 'all is null', code: all(null), filename: project },
    { name: 'an empty list', code: listed([]), filename: project },
    { name: 'listed is a string', code: listed('memory'), filename: project },
    { name: 'listed is an object', code: listed({ memory: true }), filename: project },
    // The rejection key approves nothing.
    {
      name: 'disabledMcpjsonServers',
      code: JSON.stringify({ disabledMcpjsonServers: ['memory'] }),
      filename: project,
    },
    // A key inside a value is not the key.
    {
      name: 'a nested key',
      code: JSON.stringify({ env: { enableAllProjectMcpServers: true } }),
      filename: project,
    },
    // Two keys of one name. The rule reads the last.
    {
      name: 'duplicate all, the last is false',
      code: '{"enableAllProjectMcpServers": true, "enableAllProjectMcpServers": false}',
      filename: project,
    },
    {
      name: 'duplicate list, the last is empty',
      code: '{"enabledMcpjsonServers": ["a"], "enabledMcpjsonServers": []}',
      filename: project,
    },
    // A managed file is not committed to a repository as project settings.
    { name: 'all, managed file', code: all(true), filename: 'managed-settings.json' },
    {
      name: 'listed, drop-in',
      code: listed(['a']),
      filename: 'managed-settings.d/10-a.json',
    },
  ],
  invalid: [],
})

jsonTester.run('mcp-approval-committed (invalid)', rule, {
  valid: [],
  invalid: [
    {
      name: 'all, with the position of the key',
      code: all(true),
      filename: project,
      errors: [{ messageId: 'all', line: 1, column: 2, endColumn: 30 }],
    },
    {
      name: 'listed, with the position of the key',
      code: listed(['memory', 'github']),
      filename: project,
      errors: [{ messageId: 'listed', line: 1, column: 2, endColumn: 25 }],
    },
    {
      name: 'a list with an entry that is no string',
      code: listed([1]),
      filename: project,
      errors: [{ messageId: 'listed' }],
    },
    {
      name: 'both keys',
      code: JSON.stringify({ enableAllProjectMcpServers: true, enabledMcpjsonServers: ['a'] }),
      filename: project,
      errors: [{ messageId: 'all' }, { messageId: 'listed' }],
    },
    {
      name: 'a nested directory',
      code: all(true),
      filename: 'packages/app/.claude/settings.json',
      errors: [{ messageId: 'all' }],
    },
    {
      name: 'duplicate all, the last is true',
      code: '{"enableAllProjectMcpServers": false, "enableAllProjectMcpServers": true}',
      filename: project,
      errors: [{ messageId: 'all', column: 39 }],
    },
    {
      name: 'duplicate list, the last has an entry',
      code: '{"enabledMcpjsonServers": [], "enabledMcpjsonServers": ["a"]}',
      filename: project,
      errors: [{ messageId: 'listed', column: 31 }],
    },
  ],
})

// The text of each message.
jsonTester.run('mcp-approval-committed (message text)', rule, {
  valid: [],
  invalid: [
    {
      code: all(true),
      filename: project,
      errors: [
        {
          message:
            'The committed "enableAllProjectMcpServers": true approves every server of .mcp.json without a prompt in a trusted folder. Claude Code ignores it in an untrusted folder. Remove the key, and let each user approve the servers.',
        },
      ],
    },
    {
      code: listed(['a']),
      filename: project,
      errors: [
        {
          message:
            'The committed "enabledMcpjsonServers" approves the listed servers of .mcp.json without a prompt in a trusted folder. Claude Code ignores it in an untrusted folder. Remove the key, and let each user approve the servers.',
        },
      ],
    },
  ],
})
