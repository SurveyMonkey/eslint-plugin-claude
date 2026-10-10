// An entry of `allowedMcpServers` or `deniedMcpServers` has exactly one key: `serverName`,
// `serverCommand` or `serverUrl`. The settings reference and the managed MCP page give the schema
// ("Match servers by URL, command, or name"). The files glob is in tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { jsonTester, lintJson, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('mcp-policy-entry-schema')

const project = '.claude/settings.json'
const local = '.claude/settings.local.json'
const managed = 'managed-settings.json'
const dropIn = 'etc/claude-code/managed-settings.d/10-a.json'
const allow = (...entries: unknown[]) => JSON.stringify({ allowedMcpServers: entries })
const deny = (...entries: unknown[]) => JSON.stringify({ deniedMcpServers: entries })

jsonTester.run('mcp-policy-entry-schema (valid)', rule, {
  valid: [
    {
      name: 'the three keys, in an allowlist',
      code: allow(
        { serverName: 'github' },
        { serverCommand: ['npx', '-y', 'server'] },
        { serverUrl: 'https://mcp.example.com/*' },
      ),
      filename: managed,
    },
    {
      name: 'the three keys, in a denylist',
      code: deny(
        { serverName: 'claude.ai Slack' },
        { serverCommand: ['npx'] },
        { serverUrl: 'https://*.example.com/*' },
      ),
      filename: dropIn,
    },
    {
      name: 'empty lists',
      code: JSON.stringify({ allowedMcpServers: [], deniedMcpServers: [] }),
      filename: managed,
    },
    { name: 'no list', code: JSON.stringify({ model: 'x' }), filename: managed },
    { name: 'array body', code: '[]', filename: managed },
    // A value that is not a list gets no report here.
    {
      name: 'allowlist is an object',
      code: JSON.stringify({ allowedMcpServers: {} }),
      filename: managed,
    },
    {
      name: 'denylist is a string',
      code: JSON.stringify({ deniedMcpServers: 'x' }),
      filename: managed,
    },
    // The allowlist name: the whole set of characters, and the ends.
    {
      name: 'allow names',
      code: allow(
        { serverName: 'a' },
        { serverName: 'A-z_0-9' },
        { serverName: '-' },
        { serverName: '_' },
        { serverName: '9' },
      ),
      filename: project,
    },
    // The denylist name: any non-empty string with no whitespace at the ends.
    {
      name: 'deny names',
      code: deny(
        { serverName: 'a' },
        { serverName: 'claude.ai Slack' },
        { serverName: 'a b' },
        { serverName: '*' },
        { serverName: 'gh-*' },
        { serverName: 'ü' },
      ),
      filename: project,
    },
    // A `*` in a name is literal, so the rule does not report it in a denylist.
    { name: 'a star, deny', code: deny({ serverName: 'github-*' }), filename: local },
    // A `serverCommand` or `serverUrl` has no further rule here.
    { name: 'an empty command', code: allow({ serverCommand: [] }), filename: project },
    { name: 'an empty url', code: allow({ serverUrl: '' }), filename: project },
    { name: 'a command with a space', code: deny({ serverCommand: [' x '] }), filename: project },
    // Two keys of one name in an entry give one key.
    {
      name: 'duplicate key in an entry',
      code: '{"allowedMcpServers": [{"serverName": "a", "serverName": "b"}]}',
      filename: project,
    },
    {
      name: 'duplicate key, the last is valid',
      code: '{"allowedMcpServers": [{"serverName": "a b", "serverName": "b"}]}',
      filename: project,
    },
    // Two lists of one name. The rule reads the last.
    {
      name: 'duplicate list, the last is empty',
      code: '{"allowedMcpServers": [1], "allowedMcpServers": []}',
      filename: project,
    },
    // Claude Code ignores a hidden drop-in.
    { name: 'hidden drop-in', code: allow(1), filename: 'managed-settings.d/.10-a.json' },
    // The key `serverName` is read in the list of a settings file only.
    {
      name: 'a key outside a list',
      code: JSON.stringify({ env: { allowedMcpServers: [1] } }),
      filename: project,
    },
  ],
  invalid: [],
})

jsonTester.run('mcp-policy-entry-schema (invalid)', rule, {
  valid: [],
  invalid: [
    // The entry is not an object.
    ...[1, 'github', null, true, ['serverName']].map((entry) => ({
      name: `entry ${JSON.stringify(entry)}`,
      code: allow(entry),
      filename: managed,
      errors: [{ messageId: 'notObject' as const, data: { list: 'allowedMcpServers' } }],
    })),
    {
      name: 'entry that is no object, in a denylist, with the position',
      code: deny('x'),
      filename: project,
      errors: [
        {
          messageId: 'notObject',
          data: { list: 'deniedMcpServers' },
          line: 1,
          column: 22,
          endColumn: 25,
        },
      ],
    },
    // The count of keys.
    {
      name: 'no key',
      code: allow({}),
      filename: managed,
      errors: [{ messageId: 'keyCount', data: { list: 'allowedMcpServers', count: '0' } }],
    },
    {
      name: 'two keys, with the position of the entry',
      code: deny({ serverName: 'a', serverUrl: 'https://x.test' }),
      filename: managed,
      errors: [
        {
          messageId: 'keyCount',
          data: { list: 'deniedMcpServers', count: '2' },
          line: 1,
          column: 22,
          endColumn: 69,
        },
      ],
    },
    {
      name: 'a valid key and an unknown key',
      code: allow({ serverName: 'a', foo: 1 }),
      filename: managed,
      errors: [{ messageId: 'keyCount', data: { list: 'allowedMcpServers', count: '2' } }],
    },
    {
      name: 'three keys',
      code: allow({ serverName: 'a', serverUrl: 'b', serverCommand: ['c'] }),
      filename: managed,
      errors: [{ messageId: 'keyCount', data: { list: 'allowedMcpServers', count: '3' } }],
    },
    // The key.
    {
      name: 'an unknown key, with the position of the key',
      code: allow({ server: 'a' }),
      filename: managed,
      errors: [
        {
          messageId: 'unknownKey',
          data: { list: 'allowedMcpServers', key: 'server' },
          line: 1,
          column: 24,
          endColumn: 32,
        },
      ],
    },
    {
      name: 'a key in another case',
      code: deny({ ServerName: 'a' }),
      filename: managed,
      errors: [{ messageId: 'unknownKey', data: { list: 'deniedMcpServers', key: 'ServerName' } }],
    },
    {
      name: 'an Object.prototype name is an unknown key',
      code: allow({ constructor: 'a' }),
      filename: managed,
      errors: [
        { messageId: 'unknownKey', data: { list: 'allowedMcpServers', key: 'constructor' } },
      ],
    },
    // The value type.
    ...[1, null, ['a'], {}, true].map((value) => ({
      name: `serverName ${JSON.stringify(value)}`,
      code: allow({ serverName: value }),
      filename: managed,
      errors: [
        {
          messageId: 'valueType' as const,
          data: { list: 'allowedMcpServers', key: 'serverName', expected: 'a string' },
        },
      ],
    })),
    ...[1, null, 'npx', {}, ['npx', 1], [null], [['a']]].map((value) => ({
      name: `serverCommand ${JSON.stringify(value)}`,
      code: deny({ serverCommand: value }),
      filename: managed,
      errors: [
        {
          messageId: 'valueType' as const,
          data: { list: 'deniedMcpServers', key: 'serverCommand', expected: 'an array of strings' },
        },
      ],
    })),
    ...[1, null, ['https://x.test'], {}, false].map((value) => ({
      name: `serverUrl ${JSON.stringify(value)}`,
      code: allow({ serverUrl: value }),
      filename: managed,
      errors: [
        {
          messageId: 'valueType' as const,
          data: { list: 'allowedMcpServers', key: 'serverUrl', expected: 'a string' },
        },
      ],
    })),
    {
      name: 'the value is the node of the report',
      code: allow({ serverName: 12 }),
      filename: managed,
      errors: [{ messageId: 'valueType', line: 1, column: 37, endColumn: 39 }],
    },
    // The allowlist name.
    ...['', ' ', 'a b', 'a.b', 'a*', '*', 'claude.ai Slack', 'ü', 'a\n', ' a', 'a/b', 'a:b'].map(
      (value) => ({
        name: `allow name ${JSON.stringify(value)}`,
        code: allow({ serverName: value }),
        filename: managed,
        errors: [{ messageId: 'allowName' as const, data: { value } }],
      }),
    ),
    {
      name: 'allow name, with the position of the value',
      code: allow({ serverName: 'a b' }),
      filename: project,
      errors: [{ messageId: 'allowName', line: 1, column: 37, endColumn: 42 }],
    },
    // The denylist name.
    ...['', ' ', ' a', 'a ', ' a ', '\ta', 'a\n', ' a'].map((value) => ({
      name: `deny name ${JSON.stringify(value)}`,
      code: deny({ serverName: value }),
      filename: managed,
      errors: [{ messageId: 'denyName' as const }],
    })),
    {
      name: 'deny name, with the position of the value',
      code: deny({ serverName: '' }),
      filename: project,
      errors: [{ messageId: 'denyName', line: 1, column: 36, endColumn: 38 }],
    },
    // Each entry gets its own report, in both lists.
    {
      name: 'several entries and both lists',
      code: JSON.stringify({
        allowedMcpServers: [{ serverName: 'ok' }, 1, { serverName: 'a b' }],
        deniedMcpServers: [{ serverName: ' x' }, { a: 1 }],
      }),
      filename: managed,
      errors: [
        { messageId: 'notObject' },
        { messageId: 'allowName' },
        { messageId: 'denyName' },
        { messageId: 'unknownKey' },
      ],
    },
    // The files.
    {
      name: 'the local file',
      code: allow(1),
      filename: local,
      errors: [{ messageId: 'notObject' }],
    },
    {
      name: 'a drop-in',
      code: deny({}),
      filename: dropIn,
      errors: [{ messageId: 'keyCount' }],
    },
    // Two keys of one name in the top-level object. The rule reads the last.
    {
      name: 'duplicate list, the last is invalid',
      code: '{"allowedMcpServers": [], "allowedMcpServers": [1]}',
      filename: managed,
      errors: [{ messageId: 'notObject' }],
    },
    // Two keys of one name in an entry give one key. It is the last.
    {
      name: 'duplicate key in an entry, the last is invalid',
      code: '{"allowedMcpServers": [{"serverName": "a", "serverName": "a b"}]}',
      filename: project,
      errors: [{ messageId: 'allowName', data: { value: 'a b' } }],
    },
    {
      name: 'duplicate key, the last is a bad type',
      code: '{"allowedMcpServers": [{"serverName": "a", "serverName": 1}]}',
      filename: project,
      errors: [{ messageId: 'valueType' }],
    },
  ],
})

describe('mcp-policy-entry-schema on a hidden drop-in', () => {
  it('reports in a drop-in that is not hidden', () => {
    expect(
      lintJson('mcp-policy-entry-schema', allow(1), 'managed-settings.d/10-a.json'),
    ).toHaveLength(1)
  })
  it('is silent in a hidden drop-in', () => {
    expect(lintJson('mcp-policy-entry-schema', allow(1), 'managed-settings.d/.10-a.json')).toEqual(
      [],
    )
  })
})

// The text of each message.
jsonTester.run('mcp-policy-entry-schema (message text)', rule, {
  valid: [],
  invalid: [
    {
      code: allow(1),
      filename: managed,
      errors: [
        {
          message:
            'An entry of "allowedMcpServers" is an object with one key: serverName, serverCommand or serverUrl.',
        },
      ],
    },
    {
      code: deny({}),
      filename: managed,
      errors: [
        {
          message:
            'An entry of "deniedMcpServers" has 0 keys. It needs exactly one of serverName, serverCommand and serverUrl.',
        },
      ],
    },
    {
      code: allow({ foo: 1 }),
      filename: managed,
      errors: [
        {
          message:
            'The key "foo" is not valid in an entry of "allowedMcpServers". Use serverName, serverCommand or serverUrl.',
        },
      ],
    },
    {
      code: deny({ serverCommand: 'npx' }),
      filename: managed,
      errors: [
        {
          message:
            'The value of "serverCommand" in an entry of "deniedMcpServers" must be an array of strings.',
        },
      ],
    },
    {
      code: allow({ serverName: 'a b' }),
      filename: managed,
      errors: [
        {
          message:
            'A serverName in "allowedMcpServers" holds letters, numbers, hyphens and underscores only. "a b" does not match.',
        },
      ],
    },
    {
      code: deny({ serverName: ' a' }),
      filename: managed,
      errors: [
        {
          message:
            'A serverName in "deniedMcpServers" is not empty and has no leading or trailing whitespace.',
        },
      ],
    },
  ],
})
