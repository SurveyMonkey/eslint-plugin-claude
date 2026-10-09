// The expected values come from the env vars reference
// (https://code.claude.com/docs/en/env-vars#variables): `ANTHROPIC_API_KEY` is sent as the
// `X-Api-Key` header, `ANTHROPIC_AUTH_TOKEN` as the `Authorization` header, and
// `ANTHROPIC_CUSTOM_HEADERS` holds `Name: Value` lines. `CLAUDE_CODE_OAUTH_TOKEN` is an OAuth
// access token.

import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-env-credential')

const project = '.claude/settings.json'
const local = '.claude/settings.local.json'
const managed = 'managed-settings.json'
const dropIn = 'managed-settings.d/10-x.json'
const ALL = [project, local, managed, dropIn]
const obj = (value: object) => JSON.stringify(value)
const env = (value: object) => obj({ env: value })

// A credential that must never appear in a message.
const SECRET = 'sk-ant-secret-0123456789'

const VARIABLES = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN']

jsonTester.run('settings-env-credential (valid)', rule, {
  valid: [
    // Variables that are no credential.
    ...ALL.map((filename) => ({
      code: env({ ANTHROPIC_BASE_URL: 'https://proxy.example.com', ANTHROPIC_MODEL: 'opus' }),
      filename,
    })),
    // `CLAUDE_CODE_CLIENT_KEY` is the path to a key file, not a credential.
    ...ALL.map((filename) => ({
      code: env({ CLAUDE_CODE_CLIENT_KEY: '/etc/ssl/client.key' }),
      filename,
    })),
    // `""` cancels a shell value. It holds no credential. A blank value is the same.
    ...VARIABLES.flatMap((key) =>
      ['', '  '].map((value) => ({ code: env({ [key]: value }), filename: project })),
    ),
    // A value that is not a string is for `settings-env-value-format`.
    ...VARIABLES.flatMap((key) =>
      [null, 1, true, ['x'], { a: 'b' }].map((value) => ({
        code: env({ [key]: value }),
        filename: project,
      })),
    ),
    // Headers that carry no credential. A name is the text before the first colon.
    ...ALL.map((filename) => ({
      code: env({ ANTHROPIC_CUSTOM_HEADERS: 'Accept-Language: en\nX-Team: a' }),
      filename,
    })),
    // The credential names inside a value or another name are no credential header.
    {
      code: env({ ANTHROPIC_CUSTOM_HEADERS: 'X-Note: Authorization: x\nX-Authorization-Id: 1' }),
      filename: project,
    },
    {
      code: env({ ANTHROPIC_CUSTOM_HEADERS: 'X-Api-Key-Id: 1\nXAuthorization: 1' }),
      filename: project,
    },
    // A line without a colon has no name.
    { code: env({ ANTHROPIC_CUSTOM_HEADERS: 'Authorization' }), filename: project },
    // A name with no text after the colon holds no credential, as a blank variable value.
    ...['Authorization:', 'X-Api-Key:  ', 'Accept: x\nauthorization:\t\nX-Api-Key:'].map(
      (value) => ({
        code: env({ ANTHROPIC_CUSTOM_HEADERS: value }),
        filename: project,
      }),
    ),
    // A name without a colon must not match on a cut-off name.
    ...['Authorizationx', 'X-Api-Keys', 'Authorizatio'].map((value) => ({
      code: env({ ANTHROPIC_CUSTOM_HEADERS: value }),
      filename: project,
    })),
    { code: env({ ANTHROPIC_CUSTOM_HEADERS: '' }), filename: project },
    { code: env({ ANTHROPIC_CUSTOM_HEADERS: ['Authorization: x'] }), filename: project },
    // A variable outside `env`, and inside a nested value, is no env variable.
    ...ALL.map((filename) => ({
      code: obj({ ANTHROPIC_API_KEY: SECRET, hooks: { env: { ANTHROPIC_API_KEY: SECRET } } }),
      filename,
    })),
    ...ALL.map((filename) => ({
      code: obj({ sandbox: { env: { ANTHROPIC_API_KEY: SECRET } } }),
      filename,
    })),
    // An `env` that is not an object has no variable.
    ...ALL.flatMap((filename) =>
      ['"x"', '[1]', 'null', '1', 'true'].map((value) => ({
        code: `{"env": ${value}}`,
        filename,
      })),
    ),
    // `apiKeyHelper` is the way to set a credential.
    ...ALL.map((filename) => ({ code: obj({ apiKeyHelper: '/bin/get-key.sh' }), filename })),
    // A top-level value that is not an object has no keys.
    ...ALL.flatMap((filename) =>
      ['[1]', '"x"', 'null', '1', 'true'].map((code) => ({ code, filename })),
    ),
    // Claude Code ignores a hidden drop-in.
    { code: env({ ANTHROPIC_API_KEY: SECRET }), filename: 'managed-settings.d/.10-x.json' },
    { code: env({ ANTHROPIC_API_KEY: SECRET }), filename: 'etc/managed-settings.d/.10-x.json' },
    // Two keys of one name. The rule reads the last, as `JSON.parse` does.
    {
      code: `{"env": {"ANTHROPIC_API_KEY": "${SECRET}", "ANTHROPIC_API_KEY": ""}}`,
      filename: project,
    },
    { code: `{"env": {"ANTHROPIC_API_KEY": "${SECRET}"}, "env": {}}`, filename: project },
  ],
  invalid: [],
})

jsonTester.run('settings-env-credential (invalid)', rule, {
  valid: [],
  invalid: [
    // Each variable reports in each file, on the key.
    ...VARIABLES.flatMap((name) =>
      ALL.map((filename) => ({
        code: env({ FOO: 'x', [name]: SECRET }),
        filename,
        errors: [
          {
            messageId: 'variable' as const,
            data: { name },
            line: 1,
            column: 19,
            endColumn: 19 + name.length + 2,
          },
        ],
      })),
    ),
    // A drop-in with the name of a project file is a managed file.
    ...['managed-settings.d/settings.json', 'managed-settings.d/settings.local.json'].map(
      (filename) => ({
        code: env({ ANTHROPIC_API_KEY: SECRET }),
        filename,
        errors: [{ messageId: 'variable' as const }],
      }),
    ),
    // A hidden name outside the directory is no drop-in.
    {
      code: env({ ANTHROPIC_API_KEY: SECRET }),
      filename: '.claude/.settings.local.json',
      errors: [{ messageId: 'variable' as const }],
    },
    // A header line with a credential name, in either letter case of the docs. The report is
    // on the value. The text of the line is not in the message.
    ...[
      [`Authorization: Bearer ${SECRET}`, 'Authorization'],
      [`X-Api-Key: ${SECRET}`, 'X-Api-Key'],
      [`Accept-Language: en\nAuthorization: ${SECRET}`, 'Authorization'],
      [`X-Team: a\r\nX-Api-Key: ${SECRET}`, 'X-Api-Key'],
      [`  Authorization  : ${SECRET}`, 'Authorization'],
      [`authorization: ${SECRET}`, 'Authorization'],
      [`X-API-KEY: ${SECRET}`, 'X-Api-Key'],
      ['X-Api-Key: a\nAuthorization: b', 'X-Api-Key'],
    ].flatMap(([value, header]) =>
      ALL.map((filename) => ({
        code: env({ ANTHROPIC_CUSTOM_HEADERS: value }),
        filename,
        errors: [{ messageId: 'header' as const, data: { header }, line: 1, column: 36 }],
      })),
    ),
    // The text of each message. It names `apiKeyHelper`, and holds no value.
    {
      code: env({ ANTHROPIC_AUTH_TOKEN: SECRET }),
      filename: project,
      errors: [
        {
          message:
            'The "env" block sets "ANTHROPIC_AUTH_TOKEN", a credential, in a settings file. Use "apiKeyHelper" to get a credential at run time.',
        },
      ],
    },
    {
      code: env({ ANTHROPIC_CUSTOM_HEADERS: `Authorization: ${SECRET}` }),
      filename: project,
      errors: [
        {
          message:
            'The "env" block sets "ANTHROPIC_CUSTOM_HEADERS" with the header "Authorization", a credential, in a settings file. Use "apiKeyHelper" to get a credential at run time.',
        },
      ],
    },
    // A blank header line is skipped. A later line with a value reports.
    {
      code: env({ ANTHROPIC_CUSTOM_HEADERS: 'Authorization:\nX-Api-Key: k' }),
      filename: project,
      errors: [{ messageId: 'header' as const, data: { header: 'X-Api-Key' } }],
    },
    // One report for each variable.
    {
      code: env({
        ANTHROPIC_API_KEY: SECRET,
        CLAUDE_CODE_OAUTH_TOKEN: SECRET,
        ANTHROPIC_CUSTOM_HEADERS: `X-Api-Key: ${SECRET}`,
      }),
      filename: project,
      errors: [
        { messageId: 'variable' as const },
        { messageId: 'variable' as const },
        { messageId: 'header' as const },
      ],
    },
    // Two keys of one name. The rule reads the last.
    {
      code: `{"env": {"ANTHROPIC_API_KEY": "", "ANTHROPIC_API_KEY": "${SECRET}"}}`,
      filename: project,
      errors: [{ messageId: 'variable' as const, column: 35 }],
    },
    {
      code: `{"env": {"ANTHROPIC_API_KEY": ""}, "env": {"ANTHROPIC_AUTH_TOKEN": "${SECRET}"}}`,
      filename: project,
      errors: [{ messageId: 'variable' as const, data: { name: 'ANTHROPIC_AUTH_TOKEN' } }],
    },
  ],
})

// A credential is never in a message, whatever the variable.
describe('settings-env-credential message', () => {
  const lint = (code: string) =>
    new Linter().verify(
      code,
      [
        {
          files: ['**/*.json'],
          plugins: { json, claude: plugin },
          language: 'json/json',
          rules: { 'claude/settings-env-credential': 'error' },
        },
      ],
      { filename: project },
    )

  it.each([
    env({ ANTHROPIC_API_KEY: SECRET }),
    env({ CLAUDE_CODE_OAUTH_TOKEN: SECRET }),
    env({ ANTHROPIC_CUSTOM_HEADERS: `Authorization: Bearer ${SECRET}` }),
  ])('never prints the value: %s', (code) => {
    const messages = lint(code)
    expect(messages).toHaveLength(1)
    expect(messages[0]?.message).not.toContain(SECRET)
    expect(messages[0]?.message).not.toContain('sk-ant')
    expect(messages[0]?.message).toContain('apiKeyHelper')
  })
})
