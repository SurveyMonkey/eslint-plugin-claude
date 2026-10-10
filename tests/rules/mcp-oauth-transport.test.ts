// An `oauth` object works on `http` and `sse` servers. A stdio server, a server with no `type`
// and a `ws` server ignore it. The files glob is in tests/configs.test.ts.
import path from 'node:path'
import { pluginCommand } from '../plugin-fixture.test-support.ts'
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('mcp-oauth-transport')

const project = '.mcp.json'
const pluginMcp = path.resolve(pluginCommand(), '..', '..', '.mcp.json')
const oauth = { clientId: 'id', callbackPort: 8080 }
const servers = (entries: Record<string, unknown>) => JSON.stringify({ mcpServers: entries })

jsonTester.run('mcp-oauth-transport (valid)', rule, {
  valid: [
    {
      name: 'http',
      code: servers({ a: { type: 'http', url: 'https://x.test', oauth } }),
      filename: project,
    },
    {
      name: 'sse',
      code: servers({ a: { type: 'sse', url: 'https://x.test', oauth } }),
      filename: project,
    },
    {
      name: 'streamable-http is an alias of http',
      code: servers({ a: { type: 'streamable-http', url: 'https://x.test', oauth } }),
      filename: project,
    },
    { name: 'no oauth, stdio', code: servers({ a: { command: 'x' } }), filename: project },
    {
      name: 'no oauth, ws',
      code: servers({ a: { type: 'ws', url: 'wss://x.test' } }),
      filename: project,
    },
    // An `oauth` that is no object is not the OAuth config.
    {
      name: 'oauth is a string',
      code: servers({ a: { command: 'x', oauth: 'id' } }),
      filename: project,
    },
    {
      name: 'oauth is null',
      code: servers({ a: { command: 'x', oauth: null } }),
      filename: project,
    },
    // A `type` that is no string, and a type that the docs do not name, are for other rules.
    { name: 'type is a number', code: servers({ a: { type: 1, oauth } }), filename: project },
    { name: 'type is sdk', code: servers({ a: { type: 'sdk', oauth } }), filename: project },
    { name: 'entry is no object', code: servers({ a: 'x' }), filename: project },
    // The last of two servers with one name counts.
    {
      name: 'duplicate name, the last is http',
      code: `{"mcpServers": {"a": {"command": "x", "oauth": {}}, "a": {"type": "http", "oauth": {}}}}`,
      filename: project,
    },
    {
      name: 'duplicate type, the last is http',
      code: `{"mcpServers": {"a": {"type": "ws", "type": "http", "oauth": {}}}}`,
      filename: project,
    },
    {
      name: 'duplicate oauth, the last is no object',
      code: `{"mcpServers": {"a": {"command": "x", "oauth": {}, "oauth": 1}}}`,
      filename: project,
    },
    { name: 'plugin, http', code: servers({ a: { type: 'http', oauth } }), filename: pluginMcp },
    {
      name: 'plugin, no wrapper',
      code: JSON.stringify({ a: { type: 'sse', oauth } }),
      filename: pluginMcp,
    },
    // Claude Code reads no file under `.claude/`. `mcp-json-location` reports it.
    {
      name: 'unread path',
      code: servers({ a: { command: 'x', oauth } }),
      filename: '.claude/.mcp.json',
    },
  ],
  invalid: [],
})

jsonTester.run('mcp-oauth-transport (invalid)', rule, {
  valid: [],
  invalid: [
    {
      name: 'stdio, with the position of the key',
      code: servers({ a: { type: 'stdio', command: 'x', oauth } }),
      filename: project,
      errors: [
        {
          messageId: 'ignored',
          data: { server: 'a', transport: 'stdio' },
          line: 1,
          column: 50,
          endColumn: 57,
        },
      ],
    },
    {
      name: 'no type means stdio',
      code: servers({ a: { command: 'x', oauth } }),
      filename: project,
      errors: [{ messageId: 'ignored', data: { server: 'a', transport: 'stdio' } }],
    },
    {
      name: 'a url without a type is still stdio',
      code: servers({ a: { url: 'https://x.test', oauth } }),
      filename: project,
      errors: [{ messageId: 'ignored', data: { server: 'a', transport: 'stdio' } }],
    },
    {
      name: 'ws',
      code: servers({ a: { type: 'ws', url: 'wss://x.test', oauth } }),
      filename: project,
      errors: [{ messageId: 'ignored', data: { server: 'a', transport: 'ws' } }],
    },
    {
      name: 'two servers, one report each',
      code: servers({
        ok: { type: 'http', oauth },
        a: { command: 'x', oauth },
        b: { type: 'ws', oauth },
      }),
      filename: project,
      errors: [
        { messageId: 'ignored', data: { server: 'a', transport: 'stdio' } },
        { messageId: 'ignored', data: { server: 'b', transport: 'ws' } },
      ],
    },
    {
      name: 'duplicate name, the last is stdio',
      code: `{"mcpServers": {"a": {"type": "http", "oauth": {}}, "a": {"command": "x", "oauth": {}}}}`,
      filename: project,
      errors: [{ messageId: 'ignored', data: { server: 'a', transport: 'stdio' } }],
    },
    {
      name: 'duplicate type, the last is ws',
      code: `{"mcpServers": {"a": {"type": "http", "type": "ws", "oauth": {}}}}`,
      filename: project,
      errors: [{ messageId: 'ignored', data: { server: 'a', transport: 'ws' } }],
    },
    {
      name: 'duplicate oauth, the last is an object',
      code: `{"mcpServers": {"a": {"command": "x", "oauth": 1, "oauth": {}}}}`,
      filename: project,
      errors: [{ messageId: 'ignored', data: { server: 'a', transport: 'stdio' } }],
    },
    {
      name: 'plugin, stdio',
      code: servers({ a: { command: 'x', oauth } }),
      filename: pluginMcp,
      errors: [{ messageId: 'ignored', data: { server: 'a', transport: 'stdio' } }],
    },
    {
      name: 'plugin, no wrapper',
      code: JSON.stringify({ a: { type: 'ws', oauth } }),
      filename: pluginMcp,
      errors: [{ messageId: 'ignored', data: { server: 'a', transport: 'ws' } }],
    },
  ],
})
