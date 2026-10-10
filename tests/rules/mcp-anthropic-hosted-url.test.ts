// Claude Code refuses a local OAuth flow for an Anthropic-hosted connector host. The errors page
// names three hosts. The option `hosts` adds more. The files glob is in tests/configs.test.ts.
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import { pluginCommand } from '../plugin-fixture.test-support.ts'
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('mcp-anthropic-hosted-url')

const project = '.mcp.json'
const pluginMcp = path.resolve(pluginCommand(), '..', '..', '.mcp.json')
const servers = (entries: Record<string, unknown>) => JSON.stringify({ mcpServers: entries })
const at = (url: string, type = 'http') => servers({ a: { type, url } })

jsonTester.run('mcp-anthropic-hosted-url (valid)', rule, {
  valid: [
    { name: 'another host', code: at('https://mcp.example.com/mcp'), filename: project },
    { name: 'the claude.ai site', code: at('https://claude.ai/mcp'), filename: project },
    // Only the listed hosts count. The docs say "include", and no page names a pattern.
    { name: 'the parent domain', code: at('https://mcp.claude.com/mcp'), filename: project },
    { name: 'a subdomain', code: at('https://api.gmail.mcp.claude.com/mcp'), filename: project },
    { name: 'a longer first label', code: at('https://xgmail.mcp.claude.com/'), filename: project },
    {
      name: 'a longer last label',
      code: at('https://gmail.mcp.claude.com.test/'),
      filename: project,
    },
    {
      name: 'the host in the path',
      code: at('https://x.test/gmail.mcp.claude.com'),
      filename: project,
    },
    {
      name: 'the host in the query',
      code: at('https://x.test/?h=gmail.mcp.claude.com'),
      filename: project,
    },
    {
      name: 'the host in userinfo',
      code: at('https://gmail.mcp.claude.com@x.test/'),
      filename: project,
    },
    // A host that is not known.
    { name: 'a reference', code: at(`https://\${HOST}/mcp`), filename: project },
    {
      name: 'a reference in the port, host unknown',
      code: at(`https://\${H}:\${P}/mcp`),
      filename: project,
    },
    {
      name: 'a reference after the host name',
      code: at(`https://gmail.mcp.claude.com\${S}/mcp`),
      filename: project,
    },
    {
      name: 'a reference with a default',
      code: at(`\${URL:-https://gmail.mcp.claude.com}`),
      filename: project,
    },
    { name: 'not a URL', code: at('gmail.mcp.claude.com'), filename: project },
    { name: 'empty url', code: at(''), filename: project },
    { name: 'url is no string', code: servers({ a: { type: 'http', url: 1 } }), filename: project },
    { name: 'no url', code: servers({ a: { type: 'http' } }), filename: project },
    // A server that is not remote does not use the `url`.
    {
      name: 'no type, which is stdio',
      code: servers({ a: { url: 'https://gmail.mcp.claude.com/mcp' } }),
      filename: project,
    },
    { name: 'stdio', code: at('https://gmail.mcp.claude.com/mcp', 'stdio'), filename: project },
    {
      name: 'type is no string',
      code: servers({ a: { type: 1, url: 'https://gmail.mcp.claude.com/mcp' } }),
      filename: project,
    },
    { name: 'entry is no object', code: servers({ a: 'x' }), filename: project },
    // The last of two servers, or two keys, with one name counts.
    {
      name: 'duplicate server, the last is silent',
      code: `{"mcpServers": {"a": {"type": "http", "url": "https://gmail.mcp.claude.com"}, "a": {"type": "http", "url": "https://x.test"}}}`,
      filename: project,
    },
    {
      name: 'duplicate url, the last is silent',
      code: `{"mcpServers": {"a": {"type": "http", "url": "https://gmail.mcp.claude.com", "url": "https://x.test"}}}`,
      filename: project,
    },
    {
      name: 'duplicate type, the last is stdio',
      code: `{"mcpServers": {"a": {"type": "http", "type": "stdio", "url": "https://gmail.mcp.claude.com"}}}`,
      filename: project,
    },
    // Claude Code reads no file under `.claude/`. `mcp-json-location` reports it.
    {
      name: 'unread path',
      code: at('https://gmail.mcp.claude.com/mcp'),
      filename: '.claude/.mcp.json',
    },
    // A project file may not omit the wrapper.
    {
      name: 'no wrapper in a project file',
      code: JSON.stringify({ a: { type: 'http', url: 'https://gmail.mcp.claude.com/mcp' } }),
      filename: project,
    },
    { name: 'plugin, another host', code: at('https://x.test/mcp'), filename: pluginMcp },
  ],
  invalid: [],
})

jsonTester.run('mcp-anthropic-hosted-url (invalid)', rule, {
  valid: [],
  invalid: [
    {
      name: 'gmail, with the position of the url',
      code: at('https://gmail.mcp.claude.com/mcp'),
      filename: project,
      errors: [
        {
          messageId: 'hosted',
          data: { server: 'a', host: 'gmail.mcp.claude.com' },
          line: 1,
          column: 41,
          endColumn: 75,
        },
      ],
    },
    {
      name: 'microsoft365',
      code: at('https://microsoft365.mcp.claude.com/mcp'),
      filename: project,
      errors: [{ messageId: 'hosted', data: { server: 'a', host: 'microsoft365.mcp.claude.com' } }],
    },
    {
      name: 'gcal',
      code: at('https://gcal.mcp.claude.com/mcp'),
      filename: project,
      errors: [{ messageId: 'hosted', data: { server: 'a', host: 'gcal.mcp.claude.com' } }],
    },
    ...['streamable-http', 'sse', 'ws'].map((type) => ({
      name: `type ${type}`,
      code: at('https://gmail.mcp.claude.com/mcp', type),
      filename: project,
      errors: [{ messageId: 'hosted' as const }],
    })),
    {
      name: 'the host in upper case',
      code: at('HTTPS://GMAIL.MCP.CLAUDE.COM/mcp'),
      filename: project,
      errors: [{ messageId: 'hosted', data: { server: 'a', host: 'gmail.mcp.claude.com' } }],
    },
    {
      name: 'a trailing dot',
      code: at('https://gmail.mcp.claude.com./mcp'),
      filename: project,
      errors: [{ messageId: 'hosted', data: { server: 'a', host: 'gmail.mcp.claude.com' } }],
    },
    {
      name: 'a port and userinfo',
      code: at('https://user@gmail.mcp.claude.com:8443'),
      filename: project,
      errors: [{ messageId: 'hosted' }],
    },
    // A reference after the host does not change the host. This holds for the port too.
    ...[
      `https://gmail.mcp.claude.com/\${PATH}`,
      `https://gmail.mcp.claude.com/?x=\${Y}`,
      `https://gmail.mcp.claude.com:\${PORT}/mcp`,
      `https://gmail.mcp.claude.com:\${PORT}`,
      `https://\${USER}@gmail.mcp.claude.com/mcp`,
    ].map((url) => ({
      name: `a reference in the path or query ${url}`,
      code: at(url),
      filename: project,
      errors: [{ messageId: 'hosted' as const }],
    })),
    {
      name: 'no path',
      code: at('https://gmail.mcp.claude.com'),
      filename: project,
      errors: [{ messageId: 'hosted' }],
    },
    {
      name: 'two servers, one report each',
      code: servers({
        ok: { type: 'http', url: 'https://x.test' },
        a: { type: 'http', url: 'https://gmail.mcp.claude.com' },
        b: { type: 'sse', url: 'https://gcal.mcp.claude.com' },
      }),
      filename: project,
      errors: [
        { messageId: 'hosted', data: { server: 'a', host: 'gmail.mcp.claude.com' } },
        { messageId: 'hosted', data: { server: 'b', host: 'gcal.mcp.claude.com' } },
      ],
    },
    {
      name: 'duplicate server, the last is hosted',
      code: `{"mcpServers": {"a": {"type": "http", "url": "https://x.test"}, "a": {"type": "http", "url": "https://gmail.mcp.claude.com"}}}`,
      filename: project,
      errors: [{ messageId: 'hosted' }],
    },
    {
      name: 'duplicate url, the last is hosted',
      code: `{"mcpServers": {"a": {"type": "http", "url": "https://x.test", "url": "https://gmail.mcp.claude.com"}}}`,
      filename: project,
      errors: [{ messageId: 'hosted' }],
    },
    {
      name: 'duplicate type, the last is http',
      code: `{"mcpServers": {"a": {"type": "stdio", "type": "http", "url": "https://gmail.mcp.claude.com"}}}`,
      filename: project,
      errors: [{ messageId: 'hosted' }],
    },
    {
      name: 'plugin, with the wrapper',
      code: at('https://gmail.mcp.claude.com/mcp'),
      filename: pluginMcp,
      errors: [{ messageId: 'hosted' }],
    },
    {
      name: 'plugin, no wrapper',
      code: JSON.stringify({ a: { type: 'http', url: 'https://gcal.mcp.claude.com' } }),
      filename: pluginMcp,
      errors: [{ messageId: 'hosted' }],
    },
    {
      name: 'a nested project file',
      code: at('https://gmail.mcp.claude.com'),
      filename: 'packages/app/.mcp.json',
      errors: [{ messageId: 'hosted' }],
    },
  ],
})

jsonTester.run('mcp-anthropic-hosted-url (option hosts)', rule, {
  valid: [
    {
      name: 'a host that is not in the option',
      code: at('https://other.example.com'),
      filename: project,
      options: [{ hosts: ['mcp.example.com'] }],
    },
    {
      name: 'a subdomain of a host of the option',
      code: at('https://a.mcp.example.com'),
      filename: project,
      options: [{ hosts: ['mcp.example.com'] }],
    },
    {
      name: 'an empty list',
      code: at('https://x.test'),
      filename: project,
      options: [{ hosts: [] }],
    },
  ],
  invalid: [
    {
      name: 'a host of the option',
      code: at('https://mcp.example.com/mcp'),
      filename: project,
      options: [{ hosts: ['mcp.example.com'] }],
      errors: [{ messageId: 'hosted', data: { server: 'a', host: 'mcp.example.com' } }],
    },
    {
      name: 'the option in upper case, with a trailing dot',
      code: at('https://mcp.example.com/mcp'),
      filename: project,
      options: [{ hosts: ['MCP.Example.com.'] }],
      errors: [{ messageId: 'hosted' }],
    },
    {
      name: 'a built-in host with the option set',
      code: at('https://gmail.mcp.claude.com'),
      filename: project,
      options: [{ hosts: ['mcp.example.com'] }],
      errors: [{ messageId: 'hosted' }],
    },
  ],
})

// The text of the message.
jsonTester.run('mcp-anthropic-hosted-url (message text)', rule, {
  valid: [],
  invalid: [
    {
      code: at('https://gmail.mcp.claude.com/mcp'),
      filename: project,
      errors: [
        {
          message:
            'The server "a" is at gmail.mcp.claude.com, an Anthropic-hosted connector host. Claude Code refuses to start a local OAuth flow for it. Remove the entry, and connect the service on claude.ai.',
        },
      ],
    },
  ],
})

// The schema of the option `hosts`: a list of strings with one character or more, and no other key.
describe('mcp-anthropic-hosted-url option schema', () => {
  const lint = (options: object[]) =>
    new Linter().verify(
      at('https://mcp.example.com/mcp'),
      [
        {
          files: ['**/*.json'],
          plugins: { json, claude: plugin },
          language: 'json/json',
          rules: { 'claude/mcp-anthropic-hosted-url': ['error', ...options] },
        },
      ],
      { filename: project },
    )

  it('accepts an empty object and a list of host names', () => {
    expect(lint([{}])).toEqual([])
    expect(lint([{ hosts: ['mcp.example.com'] }])).toHaveLength(1)
  })
  it('refuses an empty name, a string, a number in the list, and an unknown key', () => {
    expect(() => lint([{ hosts: [''] }])).toThrow()
    expect(() => lint([{ hosts: 'x' }])).toThrow()
    expect(() => lint([{ hosts: [1] }])).toThrow()
    expect(() => lint([{ other: 1 }])).toThrow()
  })
})
