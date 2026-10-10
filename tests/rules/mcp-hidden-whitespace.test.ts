// Claude Code warns about leading or trailing whitespace in `command`, `url`, each `args` item,
// and the keys and values of `env` and `headers`. The files glob is in tests/configs.test.ts.
import path from 'node:path'
import { pluginCommand } from '../plugin-fixture.test-support.ts'
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('mcp-hidden-whitespace')

const project = '.mcp.json'
const pluginMcp = path.resolve(pluginCommand(), '..', '..', '.mcp.json')
const wrap = (entry: string) => `{"mcpServers": {"a": ${entry}}}`

jsonTester.run('mcp-hidden-whitespace (valid)', rule, {
  valid: [
    {
      name: 'a clean stdio entry',
      code: wrap(
        '{"command": "npx", "args": ["-y", "pkg --flag", "a b"], "env": {"KEY": "a b"}, "timeout": 5000}',
      ),
      filename: project,
    },
    {
      name: 'a clean remote entry',
      code: wrap(
        '{"type": "http", "url": "https://x.test/mcp", "headers": {"Authorization": "Bearer abc123"}}',
      ),
      filename: project,
    },
    { code: '{"mcpServers": {}}', filename: project },
    // Whitespace inside a value, and the empty string, are not at an edge.
    { code: wrap('{"command": "", "args": [""], "env": {"": ""}}'), filename: project },
    // Another field is not read. `type` and a nested object are not in the list.
    { code: wrap('{"type": " http ", "oauth": {"clientId": " x "}}'), filename: project },
    { code: wrap('{"headersHelper": " ./h ", "name": "x "}'), filename: project },
    // A value that is not a string.
    {
      code: wrap('{"command": 1, "url": null, "args": [1, null, {}], "env": {"A": 1}}'),
      filename: project,
    },
    // A field of the wrong shape: the schema rule reports it, not this rule.
    { code: wrap('{"args": " x ", "env": [" x "], "headers": " x "}'), filename: project },
    { code: wrap('{"env": {"A": [" x "]}}'), filename: project },
    // A config that is not an object, and a map that is not an object.
    { code: wrap('" x "'), filename: project },
    { code: '{"mcpServers": [" x "]}', filename: project },
    { name: 'project, no wrapper', code: '{"a": {"command": "x "}}', filename: project },
    // The last member counts, as `JSON.parse` keeps the last one.
    {
      name: 'later command is clean',
      code: wrap('{"command": "x ", "command": "y", "url": "u ", "url": "u"}'),
      filename: project,
    },
    {
      name: 'later env and headers values are clean',
      code: wrap('{"env": {"K": "a ", "K": "a"}, "headers": {"H": " b", "H": "b"}}'),
      filename: project,
    },
    { name: 'plugin, clean', code: wrap('{"command": "x"}'), filename: pluginMcp },
    // Claude Code reads no file under `.claude/`. `mcp-json-location` reports it.
    { name: 'unread path', code: wrap('{"command": "x "}'), filename: '.claude/.mcp.json' },
  ],
  invalid: [],
})

jsonTester.run('mcp-hidden-whitespace (invalid)', rule, {
  valid: [],
  invalid: [
    {
      name: 'later env value is dirty, one report',
      code: wrap('{"env": {"K": "a", "K": "a "}}'),
      filename: project,
      errors: [{ messageId: 'value', data: { field: 'env.K', server: 'a' }, column: 46 }],
    },
    {
      name: 'a key that two members repeat is one key',
      code: wrap('{"headers": {"H ": "a", "H ": "b"}}'),
      filename: project,
      errors: [{ messageId: 'key', data: { field: 'headers', server: 'a' } }],
    },
    {
      name: 'later command is dirty',
      code: wrap('{"command": "x", "command": "y "}'),
      filename: project,
      errors: [{ messageId: 'value', data: { field: 'command', server: 'a' } }],
    },
    // The report is on the value.
    {
      code: wrap('{"command": "npx "}'),
      filename: project,
      errors: [
        {
          messageId: 'value',
          data: { field: 'command', server: 'a' },
          line: 1,
          column: 34,
          endColumn: 40,
        },
      ],
    },
    { code: wrap('{"command": " npx"}'), filename: project, errors: [{ messageId: 'value' }] },
    {
      name: 'a trailing newline in a url',
      code: wrap('{"type": "http", "url": "https://x.test/mcp\\n"}'),
      filename: project,
      errors: [{ messageId: 'value', data: { field: 'url', server: 'a' } }],
    },
    {
      name: 'a tab, a carriage return and a no-break space',
      code: wrap('{"command": "\\tx", "url": "x\\r", "args": ["\\u00a0y"]}'),
      filename: project,
      errors: [
        { messageId: 'value', data: { field: 'command', server: 'a' } },
        { messageId: 'value', data: { field: 'url', server: 'a' } },
        { messageId: 'value', data: { field: 'args[0]', server: 'a' } },
      ],
    },
    {
      name: 'the item of args that has it',
      code: wrap('{"command": "npx", "args": ["-y", " pkg", "ok", "x "]}'),
      filename: project,
      errors: [
        { messageId: 'value', data: { field: 'args[1]', server: 'a' } },
        { messageId: 'value', data: { field: 'args[3]', server: 'a' } },
      ],
    },
    {
      name: 'an env value',
      code: wrap('{"command": "x", "env": {"A": "ok", "TOKEN": "abc\\n"}}'),
      filename: project,
      errors: [{ messageId: 'value', data: { field: 'env.TOKEN', server: 'a' } }],
    },
    {
      name: 'a header value',
      code: wrap(
        '{"type": "http", "url": "https://x.test", "headers": {"Authorization": "Bearer t\\n"}}',
      ),
      filename: project,
      errors: [{ messageId: 'value', data: { field: 'headers.Authorization', server: 'a' } }],
    },
    {
      name: 'an env key',
      code: wrap('{"command": "x", "env": {"KEY ": "v"}}'),
      filename: project,
      errors: [{ messageId: 'key', data: { field: 'env', server: 'a' }, line: 1, column: 47 }],
    },
    {
      name: 'a header key and its value',
      code: wrap('{"type": "http", "url": "https://x.test", "headers": {" X-Key": "v "}}'),
      filename: project,
      errors: [
        { messageId: 'key', data: { field: 'headers', server: 'a' } },
        { messageId: 'value', data: { field: 'headers. X-Key', server: 'a' } },
      ],
    },
    {
      name: 'two servers',
      code: '{"mcpServers": {"a": {"command": "x "}, "b": {"command": "y "}}}',
      filename: project,
      errors: [
        { messageId: 'value', data: { field: 'command', server: 'a' } },
        { messageId: 'value', data: { field: 'command', server: 'b' } },
      ],
    },
    {
      name: 'plugin, wrapper',
      code: wrap('{"command": "x "}'),
      filename: pluginMcp,
      errors: [{ messageId: 'value' }],
    },
    {
      name: 'plugin, no wrapper',
      code: '{"a": {"command": "x "}}',
      filename: pluginMcp,
      errors: [{ messageId: 'value', data: { field: 'command', server: 'a' } }],
    },
  ],
})

// The text of each message. Neither one echoes a value.
jsonTester.run('mcp-hidden-whitespace (message text)', rule, {
  valid: [],
  invalid: [
    {
      code: wrap(
        '{"type": "http", "url": "https://x.test", "headers": {"Authorization": "secret\\n"}}',
      ),
      filename: project,
      errors: [
        {
          message:
            'The value of `headers.Authorization` in the server "a" has leading or trailing whitespace. Claude Code uses it as written.',
        },
      ],
    },
    {
      code: wrap('{"command": "x", "env": {"KEY ": "v"}}'),
      filename: project,
      errors: [
        {
          message:
            'A key of `env` in the server "a" has leading or trailing whitespace. Claude Code uses it as written.',
        },
      ],
    },
  ],
})
