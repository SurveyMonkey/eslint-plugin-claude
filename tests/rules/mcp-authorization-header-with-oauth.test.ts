// With a static `Authorization` header, Claude Code never falls back to OAuth. The rule reads
// `http`, `streamable-http` and `sse` servers. `mcp-oauth-transport` owns the other transports.
// The files glob is in tests/configs.test.ts.
import path from 'node:path'
import { pluginCommand } from '../plugin-fixture.test-support.ts'
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('mcp-authorization-header-with-oauth')

const project = '.mcp.json'
const pluginMcp = path.resolve(pluginCommand(), '..', '..', '.mcp.json')
const servers = (entries: Record<string, unknown>) => JSON.stringify({ mcpServers: entries })
const remote = (extra: Record<string, unknown>, type = 'http') =>
  servers({ a: { type, url: 'https://x.test/mcp', ...extra } })

jsonTester.run('mcp-authorization-header-with-oauth (valid)', rule, {
  valid: [
    { name: 'oauth only', code: remote({ oauth: {} }), filename: project },
    {
      name: 'header only',
      code: remote({ headers: { Authorization: `Bearer \${T}` } }),
      filename: project,
    },
    {
      name: 'oauth and another header',
      code: remote({ oauth: {}, headers: { 'X-Team': 'a' } }),
      filename: project,
    },
    {
      name: 'oauth and an empty headers object',
      code: remote({ oauth: {}, headers: {} }),
      filename: project,
    },
    {
      name: 'oauth is no object',
      code: remote({ oauth: 'x', headers: { Authorization: 't' } }),
      filename: project,
    },
    {
      name: 'a headersHelper is not read',
      code: remote({ oauth: {}, headersHelper: 'get-headers' }),
      filename: project,
    },
    {
      name: 'duplicate oauth, the last is no object',
      code: `{"mcpServers": {"a": {"type": "http", "oauth": {}, "oauth": 1, "headers": {"Authorization": "t"}}}}`,
      filename: project,
    },
    { name: 'headers is no object', code: remote({ oauth: {}, headers: 'x' }), filename: project },
    // `mcp-oauth-transport` owns these.
    {
      name: 'stdio',
      code: servers({ a: { command: 'x', oauth: {}, headers: { Authorization: 't' } } }),
      filename: project,
    },
    {
      name: 'ws',
      code: remote({ oauth: {}, headers: { Authorization: 't' } }, 'ws'),
      filename: project,
    },
    {
      name: 'type is no string',
      code: servers({ a: { type: 1, oauth: {}, headers: { Authorization: 't' } } }),
      filename: project,
    },
    {
      name: 'duplicate server, the last has no header',
      code: `{"mcpServers": {"a": {"type": "http", "oauth": {}, "headers": {"Authorization": "t"}}, "a": {"type": "http", "oauth": {}}}}`,
      filename: project,
    },
    {
      name: 'duplicate type, the last is ws',
      code: `{"mcpServers": {"a": {"type": "http", "type": "ws", "oauth": {}, "headers": {"Authorization": "t"}}}}`,
      filename: project,
    },
    { name: 'plugin, silent', code: remote({ oauth: {} }), filename: pluginMcp },
    {
      name: 'unread path',
      code: remote({ oauth: {}, headers: { Authorization: 't' } }),
      filename: '.claude/.mcp.json',
    },
  ],
  invalid: [],
})

jsonTester.run('mcp-authorization-header-with-oauth (invalid)', rule, {
  valid: [],
  invalid: [
    {
      name: 'http, on the oauth key',
      code: remote({ oauth: {}, headers: { Authorization: 'Bearer abc' } }),
      filename: project,
      errors: [
        { messageId: 'shadowed', data: { server: 'a' }, line: 1, column: 62, endColumn: 69 },
      ],
    },
    {
      name: 'sse',
      code: remote({ oauth: {}, headers: { Authorization: 't' } }, 'sse'),
      filename: project,
      errors: [{ messageId: 'shadowed', data: { server: 'a' } }],
    },
    {
      name: 'streamable-http',
      code: remote({ oauth: {}, headers: { Authorization: 't' } }, 'streamable-http'),
      filename: project,
      errors: [{ messageId: 'shadowed', data: { server: 'a' } }],
    },
    {
      name: 'header name in another letter case',
      code: remote({ oauth: {}, headers: { authorization: 't' } }),
      filename: project,
      errors: [{ messageId: 'shadowed', data: { server: 'a' } }],
    },
    {
      name: 'a header with an environment reference',
      code: remote({ oauth: {}, headers: { 'X-A': 'b', Authorization: `Bearer \${T}` } }),
      filename: project,
      errors: [{ messageId: 'shadowed', data: { server: 'a' } }],
    },
    {
      name: 'duplicate oauth, the last is an object',
      code: `{"mcpServers": {"a": {"type": "http", "oauth": 1, "oauth": {}, "headers": {"Authorization": "t"}}}}`,
      filename: project,
      errors: [{ messageId: 'shadowed', data: { server: 'a' } }],
    },
    {
      name: 'duplicate server, the last has the header',
      code: `{"mcpServers": {"a": {"type": "http", "oauth": {}}, "a": {"type": "http", "oauth": {}, "headers": {"Authorization": "t"}}}}`,
      filename: project,
      errors: [{ messageId: 'shadowed', data: { server: 'a' } }],
    },
    {
      name: 'duplicate type, the last is http',
      code: `{"mcpServers": {"a": {"type": "ws", "type": "http", "oauth": {}, "headers": {"Authorization": "t"}}}}`,
      filename: project,
      errors: [{ messageId: 'shadowed', data: { server: 'a' } }],
    },
    {
      name: 'duplicate headers, the last has it',
      code: `{"mcpServers": {"a": {"type": "http", "oauth": {}, "headers": {}, "headers": {"Authorization": "t"}}}}`,
      filename: project,
      errors: [{ messageId: 'shadowed', data: { server: 'a' } }],
    },
    {
      name: 'plugin',
      code: remote({ oauth: {}, headers: { Authorization: 't' } }),
      filename: pluginMcp,
      errors: [{ messageId: 'shadowed', data: { server: 'a' } }],
    },
    {
      name: 'plugin, no wrapper',
      code: JSON.stringify({ a: { type: 'http', oauth: {}, headers: { Authorization: 't' } } }),
      filename: pluginMcp,
      errors: [{ messageId: 'shadowed', data: { server: 'a' } }],
    },
  ],
})
