// In the `url` and `headers` of a remote server, Claude Code reads a covered credential variable
// as empty, and it ignores a `:-default`. The files glob is in tests/configs.test.ts.
import path from 'node:path'
import { pluginCommand } from '../plugin-fixture.test-support.ts'
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('mcp-credential-var-remote')

const project = '.mcp.json'
const pluginMcp = path.resolve(pluginCommand(), '..', '..', '.mcp.json')
const servers = (entries: Record<string, unknown>) => JSON.stringify({ mcpServers: entries })
const remote = (extra: Record<string, unknown>, type = 'http') =>
  servers({ a: { type, url: 'https://x.test/mcp', ...extra } })
const header = (value: string) => remote({ headers: { Authorization: value } })

jsonTester.run('mcp-credential-var-remote (valid)', rule, {
  valid: [
    { name: 'a name of your own', code: header(`Bearer \${MY_API_KEY}`), filename: project },
    { name: 'API_KEY is not covered', code: header(`Bearer \${API_KEY}`), filename: project },
    {
      name: 'a provider base URL expands',
      code: remote({ url: `\${ANTHROPIC_BASE_URL}/mcp` }),
      filename: project,
    },
    { name: 'a prefix of a covered name', code: header(`\${NPM_TOKEN_2}`), filename: project },
    { name: 'shell form is no reference', code: header('Bearer $NPM_TOKEN'), filename: project },
    { name: 'no reference', code: header('Bearer abc'), filename: project },
    { name: 'no headers', code: remote({}), filename: project },
    { name: 'headers is no object', code: remote({ headers: 'x' }), filename: project },
    { name: 'a header value is no string', code: remote({ headers: { A: 1 } }), filename: project },
    { name: 'url is no string', code: servers({ a: { type: 'http', url: 1 } }), filename: project },
    {
      name: 'stdio env expands the variable',
      code: servers({ a: { command: 'x', env: { T: `\${NPM_TOKEN}` } } }),
      filename: project,
    },
    {
      name: 'a stdio server with a url key',
      code: servers({ a: { command: 'x', url: `\${NPM_TOKEN}` } }),
      filename: project,
    },
    {
      name: 'type is no string',
      code: servers({ a: { type: 1, url: `\${NPM_TOKEN}` } }),
      filename: project,
    },
    {
      name: 'duplicate server, the last is silent',
      code: `{"mcpServers": {"a": {"type": "http", "url": "\${NPM_TOKEN}"}, "a": {"type": "http", "url": "https://x.test"}}}`,
      filename: project,
    },
    {
      name: 'duplicate header, the last is silent',
      code: `{"mcpServers": {"a": {"type": "http", "headers": {"A": "\${NPM_TOKEN}", "A": "x"}}}}`,
      filename: project,
    },
    {
      name: 'duplicate url, the last is silent',
      code: `{"mcpServers": {"a": {"type": "http", "url": "\${NPM_TOKEN}", "url": "https://x.test"}}}`,
      filename: project,
    },
    { name: 'plugin, silent', code: header(`Bearer \${MY_KEY}`), filename: pluginMcp },
    { name: 'unread path', code: header(`\${NPM_TOKEN}`), filename: '.claude/.mcp.json' },
    // The option adds a name. Without it, the name is not covered.
    { name: 'option not set', code: header(`\${MY_CRED}`), filename: project },
    {
      name: 'option set to another name',
      code: header(`\${MY_CRED}`),
      filename: project,
      options: [{ names: ['OTHER'] }],
    },
  ],
  invalid: [],
})

jsonTester.run('mcp-credential-var-remote (invalid)', rule, {
  valid: [],
  invalid: [
    {
      name: 'a header, on the string',
      code: header(`Bearer \${ANTHROPIC_AUTH_TOKEN}`),
      filename: project,
      errors: [
        {
          messageId: 'empty',
          data: { field: 'headers.Authorization', server: 'a', variable: 'ANTHROPIC_AUTH_TOKEN' },
          line: 1,
          column: 89,
        },
      ],
    },
    {
      name: 'the url',
      code: remote({ url: `https://x.test/?k=\${ANTHROPIC_API_KEY}` }),
      filename: project,
      errors: [
        { messageId: 'empty', data: { field: 'url', server: 'a', variable: 'ANTHROPIC_API_KEY' } },
      ],
    },
    {
      name: 'a default is ignored',
      code: header(`Bearer \${NPM_TOKEN:-abc}`),
      filename: project,
      errors: [
        {
          messageId: 'empty',
          data: { field: 'headers.Authorization', server: 'a', variable: 'NPM_TOKEN' },
        },
      ],
    },
    ...['AWS_BEARER_TOKEN_BEDROCK', 'HTTPS_PROXY', 'CLAUDE_CODE_OAUTH_TOKEN'].map((variable) => ({
      name: variable,
      code: header(`\${${variable}}`),
      filename: project,
      errors: [
        {
          messageId: 'empty' as const,
          data: { field: 'headers.Authorization', server: 'a', variable },
        },
      ],
    })),
    {
      name: 'two variables in one value, one repeated',
      code: header(`\${NPM_TOKEN}-\${HTTPS_PROXY}-\${NPM_TOKEN}`),
      filename: project,
      errors: [
        {
          messageId: 'empty',
          data: { field: 'headers.Authorization', server: 'a', variable: 'NPM_TOKEN' },
        },
        {
          messageId: 'empty',
          data: { field: 'headers.Authorization', server: 'a', variable: 'HTTPS_PROXY' },
        },
      ],
    },
    {
      name: 'url and header',
      code: remote({ url: `https://x.test/\${NPM_TOKEN}`, headers: { A: `\${NPM_TOKEN}` } }),
      filename: project,
      errors: [
        { messageId: 'empty', data: { field: 'url', server: 'a', variable: 'NPM_TOKEN' } },
        { messageId: 'empty', data: { field: 'headers.A', server: 'a', variable: 'NPM_TOKEN' } },
      ],
    },
    ...['sse', 'ws', 'streamable-http'].map((type) => ({
      name: type,
      code: remote({ url: `\${NPM_TOKEN}` }, type),
      filename: project,
      errors: [
        { messageId: 'empty' as const, data: { field: 'url', server: 'a', variable: 'NPM_TOKEN' } },
      ],
    })),
    {
      name: 'the option adds a name',
      code: header(`\${MY_CRED}`),
      filename: project,
      options: [{ names: ['MY_CRED'] }],
      errors: [
        {
          messageId: 'empty',
          data: { field: 'headers.Authorization', server: 'a', variable: 'MY_CRED' },
        },
      ],
    },
    {
      name: 'the option keeps the built-in names',
      code: header(`\${NPM_TOKEN}`),
      filename: project,
      options: [{ names: ['MY_CRED'] }],
      errors: [
        {
          messageId: 'empty',
          data: { field: 'headers.Authorization', server: 'a', variable: 'NPM_TOKEN' },
        },
      ],
    },
    {
      name: 'duplicate server, the last reports',
      code: `{"mcpServers": {"a": {"type": "http", "url": "https://x.test"}, "a": {"type": "http", "url": "\${NPM_TOKEN}"}}}`,
      filename: project,
      errors: [{ messageId: 'empty', data: { field: 'url', server: 'a', variable: 'NPM_TOKEN' } }],
    },
    {
      name: 'duplicate type, the last is http',
      code: `{"mcpServers": {"a": {"type": "stdio", "type": "http", "url": "\${NPM_TOKEN}"}}}`,
      filename: project,
      errors: [{ messageId: 'empty', data: { field: 'url', server: 'a', variable: 'NPM_TOKEN' } }],
    },
    {
      name: 'plugin',
      code: header(`\${NPM_TOKEN}`),
      filename: pluginMcp,
      errors: [
        {
          messageId: 'empty',
          data: { field: 'headers.Authorization', server: 'a', variable: 'NPM_TOKEN' },
        },
      ],
    },
    {
      name: 'plugin, no wrapper',
      code: JSON.stringify({ a: { type: 'http', url: `\${NPM_TOKEN}` } }),
      filename: pluginMcp,
      errors: [{ messageId: 'empty', data: { field: 'url', server: 'a', variable: 'NPM_TOKEN' } }],
    },
  ],
})
