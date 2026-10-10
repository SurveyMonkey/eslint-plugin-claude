// Claude Code runs a `headersHelper` from a project `.mcp.json` or a plugin without the
// credential variables of the user. The files glob is in tests/configs.test.ts.
import path from 'node:path'
import { pluginCommand } from '../plugin-fixture.test-support.ts'
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('mcp-headershelper-credential-env')

const project = '.mcp.json'
const pluginMcp = path.resolve(pluginCommand(), '..', '..', '.mcp.json')
const servers = (entries: Record<string, unknown>) => JSON.stringify({ mcpServers: entries })
const helper = (headersHelper: unknown) =>
  servers({ a: { type: 'http', url: 'https://x.test/mcp', headersHelper } })

jsonTester.run('mcp-headershelper-credential-env (valid)', rule, {
  valid: [
    // The inline example of the docs: a command substitution, no variable.
    {
      name: 'docs example',
      code: helper(`echo '{"Authorization": "Bearer '"$(get-token)"'"}'`),
      filename: project,
    },
    { name: 'a script path', code: helper('/opt/bin/get-mcp-auth-headers.sh'), filename: project },
    {
      name: 'variables that Claude Code sets',
      code: helper(`echo $CLAUDE_CODE_MCP_SERVER_NAME \${CLAUDE_PLUGIN_ROOT}`),
      filename: project,
    },
    {
      name: 'a variable with no credential word',
      code: helper(`echo $HOME \${USER} $_x1`),
      filename: project,
    },
    {
      name: 'git config key variables are kept',
      code: helper(`echo $GIT_CONFIG_KEY_0 \${GIT_CONFIG_KEY_12}`),
      filename: project,
    },
    { name: 'a dollar sign and a digit', code: helper('echo $1 $$ $ x'), filename: project },
    { name: 'headersHelper is no string', code: helper(1), filename: project },
    { name: 'no headersHelper', code: servers({ a: { command: 'x' } }), filename: project },
    { name: 'entry is no object', code: servers({ a: 'echo $TOKEN' }), filename: project },
    {
      name: 'other fields are not read',
      code: servers({ a: { command: 'x', env: { A: '$TOKEN' }, headers: { A: `\${TOKEN}` } } }),
      filename: project,
    },
    {
      name: 'duplicate server, the last is silent',
      code: `{"mcpServers": {"a": {"headersHelper": "echo $TOKEN"}, "a": {"headersHelper": "echo ok"}}}`,
      filename: project,
    },
    {
      name: 'duplicate headersHelper, the last is silent',
      code: `{"mcpServers": {"a": {"headersHelper": "echo $TOKEN", "headersHelper": "echo ok"}}}`,
      filename: project,
    },
    {
      name: 'a variable that the command sets first',
      code: helper('token=$(get-token); echo "{\\"A\\":\\"Bearer $token\\"}"'),
      filename: project,
    },
    {
      name: 'an exported variable that the command sets first',
      code: helper('export MY_TOKEN=$(get-token) && echo $MY_TOKEN'),
      filename: project,
    },
    { name: 'plugin, silent', code: helper('echo $HOME'), filename: pluginMcp },
    { name: 'unread path', code: helper('echo $TOKEN'), filename: '.claude/.mcp.json' },
  ],
  invalid: [],
})

jsonTester.run('mcp-headershelper-credential-env (invalid)', rule, {
  valid: [],
  invalid: [
    {
      name: 'a token, on the string',
      code: helper('echo $MY_REGISTRY_TOKEN'),
      filename: project,
      errors: [
        {
          messageId: 'removed',
          data: { server: 'a', variable: 'MY_REGISTRY_TOKEN' },
          line: 1,
          column: 78,
        },
      ],
    },
    {
      name: 'braces',
      code: helper(`curl -H "X: \${ANTHROPIC_API_KEY}" x`),
      filename: project,
      errors: [{ messageId: 'removed', data: { server: 'a', variable: 'ANTHROPIC_API_KEY' } }],
    },
    ...['MY_SECRET', 'DB_PASSWORD', 'APIKEY', 'SSH_AUTH_SOCK', 'AUTHOR'].map((variable) => ({
      name: variable,
      code: helper(`echo $${variable}`),
      filename: project,
      errors: [{ messageId: 'removed' as const, data: { server: 'a', variable } }],
    })),
    {
      name: 'lower case',
      code: helper('echo $my_token'),
      filename: project,
      errors: [{ messageId: 'removed', data: { server: 'a', variable: 'my_token' } }],
    },
    {
      name: 'a git key variable in lower case is not kept',
      code: helper('echo $git_config_key_0'),
      filename: project,
      errors: [{ messageId: 'removed', data: { server: 'a', variable: 'git_config_key_0' } }],
    },
    {
      name: 'a variable that Claude Code removes by name',
      code: helper('echo $ANTHROPIC_CUSTOM_HEADERS'),
      filename: project,
      errors: [
        { messageId: 'removed', data: { server: 'a', variable: 'ANTHROPIC_CUSTOM_HEADERS' } },
      ],
    },
    {
      name: 'two variables, one repeated, and a kept one',
      code: helper(`echo $A_TOKEN $GIT_CONFIG_KEY_1 \${B_KEY} $A_TOKEN`),
      filename: project,
      errors: [
        { messageId: 'removed', data: { server: 'a', variable: 'A_TOKEN' } },
        { messageId: 'removed', data: { server: 'a', variable: 'B_KEY' } },
      ],
    },
    {
      name: 'duplicate server, the last reports',
      code: `{"mcpServers": {"a": {"headersHelper": "echo ok"}, "a": {"headersHelper": "echo $TOKEN"}}}`,
      filename: project,
      errors: [{ messageId: 'removed', data: { server: 'a', variable: 'TOKEN' } }],
    },
    {
      name: 'duplicate headersHelper, the last reports',
      code: `{"mcpServers": {"a": {"headersHelper": "echo ok", "headersHelper": "echo $TOKEN"}}}`,
      filename: project,
      errors: [{ messageId: 'removed', data: { server: 'a', variable: 'TOKEN' } }],
    },
    {
      name: 'a flag value is no assignment',
      code: helper('curl --my-token=$MY_TOKEN x'),
      filename: project,
      errors: [{ messageId: 'removed', data: { server: 'a', variable: 'MY_TOKEN' } }],
    },
    {
      name: 'another variable is set, this one is not',
      code: helper('A_TOKEN=1; echo $B_TOKEN'),
      filename: project,
      errors: [{ messageId: 'removed', data: { server: 'a', variable: 'B_TOKEN' } }],
    },
    ...['$MY_GIT_CONFIG_KEY_0', '$GIT_CONFIG_KEY_0X', '$GIT_CONFIG_KEY_'].map((text) => ({
      name: `${text} is not a kept git variable`,
      code: helper(`echo ${text}`),
      filename: project,
      errors: [
        {
          messageId: 'removed' as const,
          data: { server: 'a', variable: text.slice(1) },
        },
      ],
    })),
    {
      name: 'single quotes do not stop the match',
      code: helper("echo '$MY_TOKEN'"),
      filename: project,
      errors: [{ messageId: 'removed', data: { server: 'a', variable: 'MY_TOKEN' } }],
    },
    {
      name: 'plugin',
      code: helper('echo $MY_TOKEN'),
      filename: pluginMcp,
      errors: [{ messageId: 'removed', data: { server: 'a', variable: 'MY_TOKEN' } }],
    },
    {
      name: 'plugin, no wrapper',
      code: JSON.stringify({ a: { type: 'http', headersHelper: 'echo $MY_TOKEN' } }),
      filename: pluginMcp,
      errors: [{ messageId: 'removed', data: { server: 'a', variable: 'MY_TOKEN' } }],
    },
  ],
})
