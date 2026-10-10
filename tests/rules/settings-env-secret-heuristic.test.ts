// The expected values come from the settings reference
// (https://code.claude.com/docs/en/settings-reference#how-env-values-interact-with-your-shell):
// "Values here are plain text in the settings file and reach every subprocess Claude Code
// starts." The env vars reference (https://code.claude.com/docs/en/env-vars) says that
// `CLAUDE_CODE_CLIENT_KEY` is the path to a key file, and its scrub list names `NPM_TOKEN` and
// `DB_PASSWORD` as names that look like a credential. The rule reads the shared file only. The
// file glob is in `tests/configs.test.ts`.
import { describe, expect, it } from 'vitest'
import { jsonTester, lintJson, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-env-secret-heuristic')

const project = '.claude/settings.json'
const env = (value: object) => JSON.stringify({ env: value })
const SECRET = `sk-ant-api03-${'x'.repeat(24)}`

jsonTester.run('settings-env-secret-heuristic (valid)', rule, {
  valid: [
    // An ordinary variable, and a name that only contains a word.
    { code: env({ NODE_ENV: 'development', MAX_THINKING_TOKENS: '8000' }), filename: project },
    {
      code: env({ TOKEN_COUNT: '5', KEY_FILE: '/x', SECRETS_DIR: '/y', PASSWORD_POLICY: 'a' }),
      filename: project,
    },
    // An empty value cancels a shell value, and holds no secret.
    { code: env({ MY_TOKEN: '', DB_PASSWORD: '' }), filename: project },
    // A value that is no string is for settings-env-value-format.
    {
      code: env({ MY_TOKEN: 5, MY_KEY: null, APP_SECRET: ['x'], DB_PASSWORD: true }),
      filename: project,
    },
    // The Claude Code credential variables and the header variable belong to settings-env-credential.
    {
      code: env({
        ANTHROPIC_API_KEY: SECRET,
        ANTHROPIC_AUTH_TOKEN: 'abc',
        CLAUDE_CODE_OAUTH_TOKEN: 'abc',
        ANTHROPIC_CUSTOM_HEADERS: 'Authorization: Bearer abc',
      }),
      filename: project,
    },
    // The header variable is skipped by name: its value has the shape of a credential here.
    { code: env({ ANTHROPIC_CUSTOM_HEADERS: SECRET }), filename: project },
    // `mcp-env-client-secret` owns this variable.
    { code: env({ MCP_CLIENT_SECRET: 'abc' }), filename: project },
    // A variable that holds the path to a key file, and not a key.
    {
      code: env({
        CLAUDE_CODE_CLIENT_KEY: '/etc/ssl/client.key',
        OTEL_EXPORTER_OTLP_CLIENT_KEY: '/etc/ssl/otel.key',
        OTEL_EXPORTER_OTLP_METRICS_CLIENT_KEY: '/etc/ssl/otel-metrics.key',
      }),
      filename: project,
    },
    // A value that only starts like a credential.
    {
      code: env({
        A: 'sk-other-123',
        B: 'ghp_short',
        C: 'AKIAshort',
        D: 'xoxx-1',
        E: 'Bearer',
        F: 'github_pat',
      }),
      filename: project,
    },
    // No env block, or a block that is no object.
    { code: '{}', filename: project },
    { code: JSON.stringify({ env: 'MY_TOKEN' }), filename: project },
    { code: '[1]', filename: project },
    // Two keys of one name: the last counts, as in `JSON.parse`.
    { code: '{"env": {"MY_TOKEN": "abc", "MY_TOKEN": ""}}', filename: project },
  ],
  invalid: [
    {
      code: '{\n  "env": {\n    "MY_TOKEN": "abc"\n  }\n}',
      filename: project,
      errors: [{ messageId: 'name', line: 3, column: 5 }],
    },
    ...[
      'MY_KEY',
      'APP_SECRET',
      'DB_PASSWORD',
      'NPM_TOKEN',
      'my_token',
      'ANTHROPIC_FOUNDRY_API_KEY',
    ].map((key) => ({
      code: env({ [key]: 'abc' }),
      filename: project,
      errors: [{ messageId: 'name' as const }],
    })),
    // A value with the shape of a credential, under a name that gives no hint.
    ...[
      SECRET,
      `ghp_${'a'.repeat(36)}`,
      `ghs_${'A1'.repeat(15)}`,
      `github_pat_${'a'.repeat(30)}`,
      'AKIAABCDEFGHIJKLMNOP',
      'ASIAABCDEFGHIJKLMNOP',
      'xoxb-123-456-abc',
      'Bearer abc.def',
    ].map((value) => ({
      code: env({ SERVICE_AUTH: value }),
      filename: project,
      errors: [{ messageId: 'value' as const, line: 1, column: 9 }],
    })),
    // A path variable with a value that has the shape of a credential.
    {
      code: env({ CLAUDE_CODE_CLIENT_KEY: SECRET }),
      filename: project,
      errors: [{ messageId: 'value' }],
    },
    // One report for a variable, even when the name and the value both match.
    {
      code: env({ MY_TOKEN: SECRET }),
      filename: project,
      errors: [{ messageId: 'name' }],
    },
    // Each variable gets its own report, and the last of two keys of one name counts.
    {
      code: '{"env": {"A_KEY": "1", "B_SECRET": "2", "MY_TOKEN": "", "MY_TOKEN": "3"}}',
      filename: project,
      errors: [{ messageId: 'name' }, { messageId: 'name' }, { messageId: 'name' }],
    },
  ],
})

describe('settings-env-secret-heuristic: messages', () => {
  const messages = (code: string) =>
    lintJson('settings-env-secret-heuristic', code, `/repo/${project}`).map((m) => m.message)

  it('names the variable and never the value', () => {
    for (const code of [env({ MY_TOKEN: 'hunter2-value' }), env({ SERVICE_AUTH: SECRET })]) {
      const [message] = messages(code)
      expect(message).toMatch(/"MY_TOKEN"|"SERVICE_AUTH"/)
      expect(message).not.toContain('hunter2')
      expect(message).not.toContain(SECRET)
      expect(message).not.toContain('sk-ant')
    }
  })

  it('says that the name or the value is the reason', () => {
    expect(messages(env({ MY_TOKEN: 'abc' }))).toEqual([
      'The name "MY_TOKEN" looks like a secret, and the value is plain text in a file that the repository commits. Every subprocess of Claude Code also gets it. Set the variable in your shell instead.',
    ])
    expect(messages(env({ SERVICE_AUTH: SECRET }))).toEqual([
      'The value of "SERVICE_AUTH" has the shape of a credential, and it is plain text in a file that the repository commits. Every subprocess of Claude Code also gets it. Set the variable in your shell instead.',
    ])
  })
})
