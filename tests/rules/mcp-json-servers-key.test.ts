// Claude Code reads the servers of a project `.mcp.json` from the top-level `mcpServers`
// object. A plugin `.mcp.json` may omit the wrapper. The files glob is in tests/configs.test.ts.
import path from 'node:path'
import { pluginCommand } from '../plugin-fixture.test-support.ts'
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('mcp-json-servers-key')

const pluginMcp = path.resolve(pluginCommand(), '..', '..', '.mcp.json')
const project = '.mcp.json'
const server = '{"command": "npx", "args": ["-y", "pkg"]}'

jsonTester.run('mcp-json-servers-key (valid)', rule, {
  valid: [
    { code: `{"mcpServers": {"db": ${server}}}`, filename: project },
    { code: '{"mcpServers": {}}', filename: project },
    { code: `{"mcpServers": {"db": ${server}}}`, filename: 'packages/app/.mcp.json' },
    {
      code: '{"mcpServers": {"db": {"type": "http", "url": "https://x.test/mcp"}}}',
      filename: project,
    },
    // The wrapper is there, so a stray `servers` key is not this rule's concern.
    { code: `{"mcpServers": {"db": ${server}}, "servers": {}}`, filename: project },
    // The last `mcpServers` member counts, as `JSON.parse` keeps the last one.
    { code: '{"mcpServers": [], "mcpServers": {}}', filename: project },
    // A plugin file may omit the wrapper, and may keep it. The rule does not read its servers.
    { name: 'plugin, no wrapper', code: `{"db": ${server}}`, filename: pluginMcp },
    { name: 'plugin, wrapper', code: `{"mcpServers": {"db": ${server}}}`, filename: pluginMcp },
    { name: 'plugin, empty', code: '{}', filename: pluginMcp },
    { name: 'plugin, vscode key', code: '{"servers": {}}', filename: pluginMcp },
    // Claude Code reads no file under `.claude/`. `mcp-json-location` reports it.
    { name: 'unread path', code: '{"servers": {}}', filename: '.claude/.mcp.json' },
  ],
  invalid: [],
})

jsonTester.run('mcp-json-servers-key (invalid)', rule, {
  valid: [],
  invalid: [
    // VS Code's key. The report is on the key.
    {
      code: `{"servers": {"db": ${server}}}`,
      filename: project,
      errors: [{ messageId: 'vscodeServers', line: 1, column: 2, endColumn: 11 }],
    },
    {
      name: 'vscode key with inputs',
      code: `{"inputs": [], "servers": {"db": ${server}}}`,
      filename: project,
      errors: [{ messageId: 'vscodeServers' }],
    },
    // The key beats a server entry at the top level.
    {
      code: `{"servers": {}, "db": ${server}}`,
      filename: project,
      errors: [{ messageId: 'vscodeServers' }],
    },
    // A server entry at the top level, found by `command`, `url` or `type`. One report for a file.
    {
      code: `{"db": ${server}}`,
      filename: project,
      errors: [{ messageId: 'unwrapped', line: 1, column: 2, endColumn: 6 }],
    },
    {
      code: '{"remote": {"url": "https://x.test/mcp"}}',
      filename: project,
      errors: [{ messageId: 'unwrapped' }],
    },
    {
      code: '{"remote": {"type": "http"}}',
      filename: project,
      errors: [{ messageId: 'unwrapped' }],
    },
    {
      name: 'two entries, one report, on the first',
      code: `{"note": 1, "a": ${server}, "b": ${server}}`,
      filename: project,
      errors: [{ messageId: 'unwrapped', line: 1, column: 13 }],
    },
    // Nothing that looks like a server.
    { code: '{}', filename: project, errors: [{ messageId: 'missing', line: 1, column: 1 }] },
    { code: '{"other": 1}', filename: project, errors: [{ messageId: 'missing' }] },
    { code: '{"a": {"b": 1}}', filename: project, errors: [{ messageId: 'missing' }] },
    { code: '{"a": "command"}', filename: project, errors: [{ messageId: 'missing' }] },
    { code: '[]', filename: project, errors: [{ messageId: 'missing' }] },
    { code: '"x"', filename: project, errors: [{ messageId: 'missing' }] },
    // The wrapper is not an object. The report is on its value.
    {
      code: '{"mcpServers": []}',
      filename: project,
      errors: [{ messageId: 'notObject', line: 1, column: 16, endColumn: 18 }],
    },
    { code: '{"mcpServers": null}', filename: project, errors: [{ messageId: 'notObject' }] },
    { code: '{"mcpServers": "db"}', filename: project, errors: [{ messageId: 'notObject' }] },
    {
      code: '{"mcpServers": {}, "mcpServers": 1}',
      filename: project,
      errors: [{ messageId: 'notObject' }],
    },
  ],
})

// The text of each message.
jsonTester.run('mcp-json-servers-key (message text)', rule, {
  valid: [],
  invalid: [
    {
      code: '{"servers": {}}',
      filename: project,
      errors: [
        {
          message:
            'The key `servers` is the form of VS Code. Claude Code reads the servers from the top-level `mcpServers` object.',
        },
      ],
    },
    {
      code: `{"db": ${server}}`,
      filename: project,
      errors: [
        {
          message:
            'This server entry is at the top level. Claude Code reads the servers from the top-level `mcpServers` object. Move the entry into it.',
        },
      ],
    },
    {
      code: '{}',
      filename: project,
      errors: [
        {
          message:
            'This file has no top-level `mcpServers` object, so Claude Code loads no server from it.',
        },
      ],
    },
    {
      code: '{"mcpServers": []}',
      filename: project,
      errors: [
        { message: 'The `mcpServers` key must be an object that maps server names to configs.' },
      ],
    },
  ],
})
