// Claude Code expands `${VAR}` in `command`, `args`, `env`, `url` and `headers`. The text stays
// as written in any other field. `headersHelper` runs in a shell, so the rule skips it. The files
// glob is in tests/configs.test.ts.
import path from 'node:path'
import { pluginCommand } from '../plugin-fixture.test-support.ts'
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('mcp-env-expansion-field')

const project = '.mcp.json'
const pluginMcp = path.resolve(pluginCommand(), '..', '..', '.mcp.json')
const servers = (entries: Record<string, unknown>) => JSON.stringify({ mcpServers: entries })
const ref = `\${ID}`
const http = { type: 'http', url: 'https://x.test/mcp' }

jsonTester.run('mcp-env-expansion-field (valid)', rule, {
  valid: [
    {
      name: 'the five fields that expand',
      code: servers({
        a: {
          command: ref,
          args: [ref],
          env: { K: ref },
          url: `https://${ref}`,
          headers: { H: ref },
        },
      }),
      filename: project,
    },
    {
      name: 'headersHelper is read by a shell',
      code: servers({ a: { ...http, headersHelper: `echo \${HOME}` } }),
      filename: project,
    },
    {
      name: 'no reference in other fields',
      code: servers({ a: { ...http, timeout: 5000, oauth: { clientId: 'id' } } }),
      filename: project,
    },
    {
      name: 'shell form in oauth is no reference',
      code: servers({ a: { ...http, oauth: { clientId: '$ID' } } }),
      filename: project,
    },
    {
      name: 'an unclosed brace',
      code: servers({ a: { ...http, oauth: { clientId: `\${ID` } } }),
      filename: project,
    },
    {
      name: 'numbers, booleans and null',
      code: servers({ a: { ...http, timeout: 1, alwaysLoad: true, x: null } }),
      filename: project,
    },
    { name: 'entry is no object', code: servers({ a: ref }), filename: project },
    {
      name: 'duplicate field, the last has no reference',
      code: `{"mcpServers": {"a": {"type": "http", "name": "\${ID}", "name": "x"}}}`,
      filename: project,
    },
    {
      name: 'duplicate server, the last has no reference',
      code: `{"mcpServers": {"a": {"x": "\${ID}"}, "a": {"x": "y"}}}`,
      filename: project,
    },
    {
      name: 'duplicate key inside oauth, the last has no reference',
      code: `{"mcpServers": {"a": {"oauth": {"id": "\${ID}", "id": "x"}}}}`,
      filename: project,
    },
    {
      name: 'plugin, silent',
      code: servers({ a: { ...http, timeout: 5000 } }),
      filename: pluginMcp,
    },
    {
      name: 'unread path',
      code: servers({ a: { ...http, timeout: ref } }),
      filename: '.claude/.mcp.json',
    },
  ],
  invalid: [],
})

jsonTester.run('mcp-env-expansion-field (invalid)', rule, {
  valid: [],
  invalid: [
    {
      name: 'timeout, on the string',
      code: servers({ a: { ...http, timeout: ref } }),
      filename: project,
      errors: [
        { messageId: 'literal', data: { field: 'timeout', server: 'a' }, line: 1, column: 72 },
      ],
    },
    {
      name: 'oauth strings, at any depth',
      code: servers({ a: { ...http, oauth: { clientId: ref, nested: { scopes: ['a', ref] } } } }),
      filename: project,
      errors: [
        { messageId: 'literal', data: { field: 'oauth', server: 'a' } },
        { messageId: 'literal', data: { field: 'oauth', server: 'a' } },
      ],
    },
    {
      name: 'a default does not help',
      code: servers({
        a: { ...http, oauth: { authServerMetadataUrl: `\${URL:-https://a.test}` } },
      }),
      filename: project,
      errors: [{ messageId: 'literal', data: { field: 'oauth', server: 'a' } }],
    },
    {
      name: 'type',
      code: servers({ a: { type: ref, url: 'https://x.test' } }),
      filename: project,
      errors: [{ messageId: 'literal', data: { field: 'type', server: 'a' } }],
    },
    {
      name: 'duplicate field, the last has a reference',
      code: `{"mcpServers": {"a": {"name": "x", "name": "\${ID}"}}}`,
      filename: project,
      errors: [{ messageId: 'literal', data: { field: 'name', server: 'a' } }],
    },
    {
      name: 'duplicate server, the last has a reference',
      code: `{"mcpServers": {"a": {"x": "y"}, "a": {"x": "\${ID}"}}}`,
      filename: project,
      errors: [{ messageId: 'literal', data: { field: 'x', server: 'a' } }],
    },
    {
      name: 'duplicate key inside oauth, the last has a reference',
      code: `{"mcpServers": {"a": {"oauth": {"id": "x", "id": "\${ID}"}}}}`,
      filename: project,
      errors: [{ messageId: 'literal', data: { field: 'oauth', server: 'a' } }],
    },
    {
      name: 'plugin',
      code: servers({ a: { ...http, timeout: ref } }),
      filename: pluginMcp,
      errors: [{ messageId: 'literal', data: { field: 'timeout', server: 'a' } }],
    },
    {
      name: 'plugin, no wrapper',
      code: JSON.stringify({ a: { ...http, oauth: { clientId: ref } } }),
      filename: pluginMcp,
      errors: [{ messageId: 'literal', data: { field: 'oauth', server: 'a' } }],
    },
  ],
})
