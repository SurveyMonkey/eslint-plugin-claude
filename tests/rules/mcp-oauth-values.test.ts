// `oauth.authServerMetadataUrl` must use `https://`. `oauth.scopes` is one string. The files
// glob is in tests/configs.test.ts.
import path from 'node:path'
import { pluginCommand } from '../plugin-fixture.test-support.ts'
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('mcp-oauth-values')

const project = '.mcp.json'
const pluginMcp = path.resolve(pluginCommand(), '..', '..', '.mcp.json')
const http = { type: 'http', url: 'https://x.test/mcp' }
const servers = (entries: Record<string, unknown>) => JSON.stringify({ mcpServers: entries })
const withOauth = (oauth: unknown) => servers({ a: { ...http, oauth } })

jsonTester.run('mcp-oauth-values (valid)', rule, {
  valid: [
    {
      code: withOauth({ authServerMetadataUrl: 'https://auth.test/.well-known/x' }),
      filename: project,
    },
    { code: withOauth({ scopes: 'channels:read chat:write' }), filename: project },
    {
      name: 'both, right',
      code: withOauth({ authServerMetadataUrl: 'https://a.test', scopes: 'a b' }),
      filename: project,
    },
    {
      name: 'URL scheme in capitals',
      code: withOauth({ authServerMetadataUrl: 'HTTPS://a.test' }),
      filename: project,
    },
    { name: 'no oauth', code: servers({ a: http }), filename: project },
    { name: 'oauth is no object', code: withOauth('x'), filename: project },
    {
      name: 'oauth with other keys',
      code: withOauth({ clientId: 'id', callbackPort: 8080 }),
      filename: project,
    },
    // Values of another type are for the schema rules, not this one.
    { name: 'url is a number', code: withOauth({ authServerMetadataUrl: 1 }), filename: project },
    { name: 'scopes is an object', code: withOauth({ scopes: {} }), filename: project },
    { name: 'entry is no object', code: servers({ a: 'x' }), filename: project },
    {
      name: 'duplicate url key, the last is right',
      code: `{"mcpServers": {"a": {"oauth": {"authServerMetadataUrl": "http://a.test", "authServerMetadataUrl": "https://a.test"}}}}`,
      filename: project,
    },
    {
      name: 'duplicate server, the last is right',
      code: `{"mcpServers": {"a": {"oauth": {"scopes": ["x"]}}, "a": {"oauth": {"scopes": "x"}}}}`,
      filename: project,
    },
    { name: 'plugin, right', code: withOauth({ scopes: 'a' }), filename: pluginMcp },
    { name: 'unread path', code: withOauth({ scopes: ['a'] }), filename: '.claude/.mcp.json' },
  ],
  invalid: [],
})

jsonTester.run('mcp-oauth-values (invalid)', rule, {
  valid: [],
  invalid: [
    {
      name: 'http URL, on the string',
      code: withOauth({ authServerMetadataUrl: 'http://auth.test/x' }),
      filename: project,
      errors: [{ messageId: 'metadataUrl', data: { server: 'a' }, line: 1, column: 95 }],
    },
    {
      name: 'URL with no scheme',
      code: withOauth({ authServerMetadataUrl: 'auth.test/x' }),
      filename: project,
      errors: [{ messageId: 'metadataUrl', data: { server: 'a' } }],
    },
    {
      name: 'empty URL',
      code: withOauth({ authServerMetadataUrl: '' }),
      filename: project,
      errors: [{ messageId: 'metadataUrl', data: { server: 'a' } }],
    },
    {
      name: 'scopes array, on the array',
      code: withOauth({ scopes: ['a', 'b'] }),
      filename: project,
      errors: [{ messageId: 'scopesArray', data: { server: 'a' }, line: 1, column: 80 }],
    },
    {
      name: 'both wrong',
      code: withOauth({ authServerMetadataUrl: 'http://a.test', scopes: [] }),
      filename: project,
      errors: [
        { messageId: 'metadataUrl', data: { server: 'a' } },
        { messageId: 'scopesArray', data: { server: 'a' } },
      ],
    },
    {
      name: 'on a stdio server too',
      code: servers({ a: { command: 'x', oauth: { scopes: ['a'] } } }),
      filename: project,
      errors: [{ messageId: 'scopesArray', data: { server: 'a' } }],
    },
    {
      name: 'duplicate url key, the last is wrong',
      code: `{"mcpServers": {"a": {"oauth": {"authServerMetadataUrl": "https://a.test", "authServerMetadataUrl": "http://a.test"}}}}`,
      filename: project,
      errors: [{ messageId: 'metadataUrl', data: { server: 'a' } }],
    },
    {
      name: 'duplicate server, the last is wrong',
      code: `{"mcpServers": {"a": {"oauth": {"scopes": "x"}}, "a": {"oauth": {"scopes": ["x"]}}}}`,
      filename: project,
      errors: [{ messageId: 'scopesArray', data: { server: 'a' } }],
    },
    {
      name: 'duplicate oauth, the last is wrong',
      code: `{"mcpServers": {"a": {"oauth": {"scopes": "x"}, "oauth": {"scopes": ["x"]}}}}`,
      filename: project,
      errors: [{ messageId: 'scopesArray', data: { server: 'a' } }],
    },
    {
      name: 'plugin, wrong',
      code: withOauth({ scopes: ['a'] }),
      filename: pluginMcp,
      errors: [{ messageId: 'scopesArray', data: { server: 'a' } }],
    },
    {
      name: 'plugin, no wrapper',
      code: JSON.stringify({ a: { ...http, oauth: { authServerMetadataUrl: 'http://x.test' } } }),
      filename: pluginMcp,
      errors: [{ messageId: 'metadataUrl', data: { server: 'a' } }],
    },
  ],
})
