// An entry of `managedMcpServers` loads only when it passes every check of "What an entry can
// contain" on the managed MCP page. The page also says that the array form is the Claude Desktop
// form, which Claude Code does not accept. The files glob is in tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { jsonTester, lintJson, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('mcp-managed-servers-entry')

const managed = 'managed-settings.json'
const dropIn = 'etc/claude-code/managed-settings.d/10-a.json'
const servers = (value: unknown) => JSON.stringify({ managedMcpServers: value })
const good = { type: 'http', url: 'https://search.example.com/mcp' }
const one = (entry: unknown, server = 'search') => servers({ [server]: entry })
const ZWSP = String.fromCodePoint(0x200b)
const LRM = String.fromCodePoint(0x200e)
const BELL = String.fromCodePoint(7)

jsonTester.run('mcp-managed-servers-entry (valid)', rule, {
  valid: [
    // The two servers of the example on the managed MCP page.
    {
      name: 'the example of the docs',
      code: servers({
        search: { type: 'http', url: 'https://search.example.com/mcp' },
        records: {
          type: 'http',
          url: 'https://records.example.com/mcp',
          headers: { 'X-Records-Key': 'key-issued-for-all-claude-code-users' },
        },
      }),
      filename: managed,
    },
    { name: 'a drop-in', code: one(good), filename: dropIn },
    {
      name: 'the sse type',
      code: one({ type: 'sse', url: 'https://a.test/sse' }),
      filename: managed,
    },
    {
      name: 'the streamable-http alias',
      code: one({ type: 'streamable-http', url: 'https://a.test/mcp' }),
      filename: managed,
    },
    {
      name: 'a URL scheme in capitals',
      code: one({ type: 'http', url: 'HTTPS://a.test/mcp' }),
      filename: managed,
    },
    {
      name: 'letters, digits, hyphen and underscore in the name',
      code: one(good, 'A-z_0-9'),
      filename: managed,
    },
    {
      name: 'the oauth member, with a scope list',
      code: one({ ...good, oauth: { clientId: 'id', scopes: 'read write' } }),
      filename: managed,
    },
    {
      name: 'a dollar sign without braces, and a brace without a dollar sign',
      code: one({ ...good, headers: { A: '$TOKEN', B: '{TOKEN}', C: `\${TOKEN` } }),
      filename: managed,
    },
    {
      name: 'numbers, Booleans and null in the entry',
      code: one({ ...good, timeout: 5000, alwaysLoad: true, extra: null, list: [1, false] }),
      filename: managed,
    },
    { name: 'no entry', code: servers({}), filename: managed },
    { name: 'no key', code: JSON.stringify({ model: 'x' }), filename: managed },
    { name: 'array body', code: '[]', filename: managed },
    // Claude Code ignores a hidden file in `managed-settings.d`.
    { name: 'hidden drop-in', code: servers([]), filename: 'managed-settings.d/.10-a.json' },
    // Two members of one name. The rule reads the last.
    {
      name: 'duplicate entry, the last is valid',
      code: `{"managedMcpServers": {"a": {"type": "stdio"}, "a": ${JSON.stringify(good)}}}`,
      filename: managed,
    },
    {
      name: 'duplicate header, the last has no reference',
      code: `{"managedMcpServers": {"a": {"type": "http", "url": "https://a.test", "headers": {"X": "\${V}", "X": "ok"}}}}`,
      filename: managed,
    },
    {
      name: 'duplicate managedMcpServers, the last is valid',
      code: `{"managedMcpServers": [], "managedMcpServers": ${JSON.stringify({ a: good })}}`,
      filename: managed,
    },
  ],
  invalid: [],
})

jsonTester.run('mcp-managed-servers-entry (invalid)', rule, {
  valid: [],
  invalid: [
    // The array form of Claude Desktop.
    {
      name: 'an array, on the value',
      code: servers([{ name: 'a', url: 'https://a.test' }]),
      filename: managed,
      errors: [{ messageId: 'notObject', line: 1, column: 22, endColumn: 59 }],
    },
    {
      name: 'a string',
      code: servers('a'),
      filename: managed,
      errors: [{ messageId: 'notObject' }],
    },
    { name: 'null', code: servers(null), filename: dropIn, errors: [{ messageId: 'notObject' }] },
    {
      name: 'duplicate managedMcpServers, the last is an array',
      code: `{"managedMcpServers": {}, "managedMcpServers": []}`,
      filename: managed,
      errors: [{ messageId: 'notObject', column: 48 }],
    },
    // The name.
    {
      name: 'a space in the name, on the name',
      code: one(good, 'my server'),
      filename: managed,
      errors: [
        { messageId: 'name', data: { server: 'my server' }, line: 1, column: 23, endColumn: 34 },
      ],
    },
    {
      name: 'a dot in the name',
      code: one(good, 'a.b'),
      filename: managed,
      errors: [{ messageId: 'name' }],
    },
    {
      name: 'an empty name',
      code: one(good, ''),
      filename: managed,
      errors: [{ messageId: 'name' }],
    },
    {
      name: 'an invisible character in the name',
      code: one(good, `a${ZWSP}b`),
      filename: managed,
      errors: [{ messageId: 'name' }],
    },
    // The entry is not an object.
    ...[
      ['a string', 'https://a.test'],
      ['an array', [good]],
      ['null', null],
    ].map(([name, entry]) => ({
      name: `an entry that is ${name as string}`,
      code: one(entry),
      filename: managed,
      errors: [{ messageId: 'entryNotObject' as const, data: { server: 'search' } }],
    })),
    // The type.
    {
      name: 'no type, on the entry',
      code: one({ url: 'https://a.test' }),
      filename: managed,
      errors: [{ messageId: 'type', line: 1, column: 32 }],
    },
    ...['stdio', 'ws', 'HTTP', ''].map((type) => ({
      name: `type "${type}", on the value`,
      code: one({ type, url: 'https://a.test' }),
      filename: managed,
      errors: [{ messageId: 'type' as const, column: 40 }],
    })),
    {
      name: 'a type that is not a string',
      code: one({ type: 1, url: 'https://a.test' }),
      filename: managed,
      errors: [{ messageId: 'type' }],
    },
    // The URL.
    {
      name: 'no url, on the entry',
      code: one({ type: 'http' }),
      filename: managed,
      errors: [{ messageId: 'url', column: 32 }],
    },
    ...[
      'http://a.test/mcp',
      'http://localhost:3000/mcp',
      'ws://a.test',
      '//a.test',
      'a.test/mcp',
      '',
      ' https://a.test',
    ].map((url) => ({
      name: `url "${url}", on the value`,
      code: one({ type: 'http', url }),
      filename: managed,
      errors: [{ messageId: 'url' as const, line: 1 }],
    })),
    {
      name: 'a url that is not a string',
      code: one({ type: 'http', url: null }),
      filename: managed,
      errors: [{ messageId: 'url' }],
    },
    // The members that name a program.
    ...[
      ['command', 'npx'],
      ['args', ['-y', 'server']],
      ['env', { A: '1' }],
      ['headersHelper', './mint-token'],
    ].map(([key, value]) => ({
      name: `the member ${key as string}, on the key`,
      code: one({ ...good, [key as string]: value }),
      filename: managed,
      errors: [{ messageId: 'forbidden' as const, data: { server: 'search', key: key as string } }],
    })),
    {
      name: 'a forbidden member of the last of two entries',
      code: `{"managedMcpServers": {"a": ${JSON.stringify(good)}, "a": {"type": "http", "url": "https://a.test", "command": "x"}}}`,
      filename: managed,
      errors: [{ messageId: 'forbidden' }],
    },
    // A ${VAR} reference, in any value.
    {
      name: 'a reference in the url, on the string',
      code: one({ type: 'http', url: `https://\${HOST}/mcp` }),
      filename: managed,
      errors: [{ messageId: 'variable', column: 53 }],
    },
    {
      name: 'a reference in a header value',
      code: one({ ...good, headers: { Authorization: `Bearer \${TOKEN}` } }),
      filename: managed,
      errors: [{ messageId: 'variable' }],
    },
    {
      name: 'a reference in an array in the oauth member',
      code: one({ ...good, oauth: { scopes: ['read', `\${SCOPE}`] } }),
      filename: managed,
      errors: [{ messageId: 'variable' }],
    },
    {
      name: 'a default value is a reference too',
      code: one({ ...good, headers: { A: `\${TOKEN:-x}` } }),
      filename: managed,
      errors: [{ messageId: 'variable' }],
    },
    // A control or invisible character, in a key or a value.
    {
      name: 'a zero width space in the url',
      code: one({ type: 'http', url: `https://a.test/${ZWSP}` }),
      filename: managed,
      errors: [{ messageId: 'invisible' }],
    },
    {
      name: 'a line break in a header value',
      code: one({ ...good, headers: { A: 'x\n' } }),
      filename: managed,
      errors: [{ messageId: 'invisible' }],
    },
    {
      name: 'a left-to-right mark in a header name, on the key',
      code: one({ ...good, headers: { [`A${LRM}`]: 'x' } }),
      filename: managed,
      errors: [{ messageId: 'invisible' }],
    },
    {
      name: 'a control character in an array item',
      code: one({ ...good, oauth: { scopes: [`a${BELL}`] } }),
      filename: managed,
      errors: [{ messageId: 'invisible' }],
    },
    // One report for each fault.
    {
      name: 'a drop-in with every fault',
      code: one({ command: 'x', url: `http://${ZWSP}\${HOST}` }, 'a b'),
      filename: dropIn,
      errors: [
        { messageId: 'name' },
        { messageId: 'type' },
        { messageId: 'forbidden' },
        { messageId: 'url' },
        { messageId: 'variable' },
        { messageId: 'invisible' },
      ],
    },
    {
      name: 'two entries with one fault each',
      code: servers({ a: { ...good, url: 'http://a.test' }, b: { ...good, type: 'ws' } }),
      filename: managed,
      errors: [
        { messageId: 'url', data: { server: 'a' } },
        { messageId: 'type', data: { server: 'b' } },
      ],
    },
  ],
})

describe('mcp-managed-servers-entry on a hidden drop-in', () => {
  it('reports in a drop-in that is not hidden', () => {
    expect(
      lintJson('mcp-managed-servers-entry', servers([]), 'managed-settings.d/10-a.json'),
    ).toHaveLength(1)
  })
  it('is silent in a hidden drop-in', () => {
    expect(
      lintJson('mcp-managed-servers-entry', servers([]), 'managed-settings.d/.10-a.json'),
    ).toEqual([])
  })
})
