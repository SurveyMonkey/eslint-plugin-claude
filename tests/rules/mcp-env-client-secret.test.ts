// `MCP_CLIENT_SECRET` is the OAuth client secret for MCP servers that need pre-configured
// credentials (env vars reference, "Variables"; MCP page, "Use pre-configured OAuth credentials").
// The committed file is `.claude/settings.json`. The local file is not committed, and a managed
// file is not a project file. The files glob is in tests/configs.test.ts.
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('mcp-env-client-secret')

const project = '.claude/settings.json'
const local = '.claude/settings.local.json'
const env = (value: unknown) => JSON.stringify({ env: value })

jsonTester.run('mcp-env-client-secret (valid)', rule, {
  valid: [
    { name: 'the local file', code: env({ MCP_CLIENT_SECRET: 's3cret' }), filename: local },
    {
      name: 'a managed file',
      code: env({ MCP_CLIENT_SECRET: 's3cret' }),
      filename: 'managed-settings.json',
    },
    {
      name: 'a drop-in',
      code: env({ MCP_CLIENT_SECRET: 's3cret' }),
      filename: 'managed-settings.d/10-a.json',
    },
    { name: 'another variable', code: env({ MCP_CLIENT_ID: 'id' }), filename: project },
    {
      name: 'a name that only ends the same',
      code: env({ X_MCP_CLIENT_SECRET: 'x' }),
      filename: project,
    },
    // An empty value cancels a value from the shell. It holds no secret.
    { name: 'an empty value', code: env({ MCP_CLIENT_SECRET: '' }), filename: project },
    { name: 'a blank value', code: env({ MCP_CLIENT_SECRET: '  ' }), filename: project },
    // The value is not a string. `settings-env-value-format` reports it.
    { name: 'null', code: env({ MCP_CLIENT_SECRET: null }), filename: project },
    { name: 'a number', code: env({ MCP_CLIENT_SECRET: 1 }), filename: project },
    // The variable is not in `env`.
    { name: 'no env', code: JSON.stringify({ model: 'x' }), filename: project },
    { name: 'env is an array', code: env([]), filename: project },
    { name: 'env is a string', code: env('MCP_CLIENT_SECRET'), filename: project },
    {
      name: 'the key outside env',
      code: JSON.stringify({ MCP_CLIENT_SECRET: 's3cret' }),
      filename: project,
    },
    {
      name: 'the key inside another value',
      code: env({ NOTE: { MCP_CLIENT_SECRET: 's3cret' } }),
      filename: project,
    },
    { name: 'array body', code: '[]', filename: project },
    // Two keys of one name. The rule reads the last.
    {
      name: 'duplicate variable, the last is empty',
      code: '{"env": {"MCP_CLIENT_SECRET": "s3cret", "MCP_CLIENT_SECRET": ""}}',
      filename: project,
    },
  ],
  invalid: [],
})

jsonTester.run('mcp-env-client-secret (invalid)', rule, {
  valid: [],
  invalid: [
    {
      name: 'the committed project file, on the name of the variable',
      code: env({ MCP_CLIENT_SECRET: 's3cret' }),
      filename: project,
      errors: [{ messageId: 'secret', line: 1, column: 9, endColumn: 28 }],
    },
    {
      name: 'a project file in a nested directory',
      code: env({ MCP_CLIENT_SECRET: 's3cret' }),
      filename: 'packages/a/.claude/settings.json',
      errors: [{ messageId: 'secret' }],
    },
    {
      name: 'one report beside other variables',
      code: env({ A: '1', MCP_CLIENT_SECRET: 's3cret', B: '2' }),
      filename: project,
      errors: [{ messageId: 'secret' }],
    },
    {
      name: 'duplicate variable, the last holds a value',
      code: '{"env": {"MCP_CLIENT_SECRET": "", "MCP_CLIENT_SECRET": "s3cret"}}',
      filename: project,
      errors: [{ messageId: 'secret', column: 35 }],
    },
    {
      name: 'duplicate env, the last holds the variable',
      code: '{"env": {}, "env": {"MCP_CLIENT_SECRET": "s3cret"}}',
      filename: project,
      errors: [{ messageId: 'secret' }],
    },
  ],
})
