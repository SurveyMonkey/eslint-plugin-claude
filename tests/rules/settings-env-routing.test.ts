// The expected values come from the server-managed settings page
// (https://code.claude.com/docs/en/server-managed-settings): the security considerations table
// says that a third-party provider variable or a non-default `ANTHROPIC_BASE_URL` bypasses
// server-managed settings, and the page on the approval dialog names the proxy and TLS variables.
// The env vars reference (https://code.claude.com/docs/en/env-vars#variables) says that a Boolean
// variable is on for `1`, `true`, `yes` and `on` in any casing, and that `""` cancels a value of
// the shell. The rule reads the shared file only. The file globs are in `tests/configs.test.ts`. `settings-env-ignored-var` reports
// `OTEL_EXPORTER_OTLP_ENDPOINT` in a project file.
import { describe, expect, it } from 'vitest'
import { envIgnoredIn } from '../../src/data/settings-env.ts'
import { jsonTester, lintJson, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-env-routing')

const project = '.claude/settings.json'
const env = (value: object) => JSON.stringify({ env: value })

const TRAFFIC = ['HTTP_PROXY', 'HTTPS_PROXY', 'NODE_EXTRA_CA_CERTS']
const PROVIDERS = [
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_MANTLE',
  'CLAUDE_CODE_USE_VERTEX',
  'CLAUDE_CODE_USE_FOUNDRY',
  'CLAUDE_CODE_USE_ANTHROPIC_AWS',
]

jsonTester.run('settings-env-routing (valid)', rule, {
  valid: [
    // `""` cancels a shell value.
    ...[...TRAFFIC, ...PROVIDERS, 'ANTHROPIC_BASE_URL'].map((key) => ({
      code: env({ [key]: '' }),
      filename: project,
    })),
    // The default host. The scheme and the port do not change the host.
    ...[
      'https://api.anthropic.com',
      'https://api.anthropic.com/v1',
      'http://api.anthropic.com:443',
    ].map((value) => ({ code: env({ ANTHROPIC_BASE_URL: value }), filename: project })),
    // An off value for a provider does not select the provider.
    ...PROVIDERS.flatMap((key) =>
      ['0', 'false', 'No', 'OFF'].map((value) => ({
        code: env({ [key]: value }),
        filename: project,
      })),
    ),
    // A value that is not a string is for `settings-env-value-format`.
    ...[...TRAFFIC, ...PROVIDERS, 'ANTHROPIC_BASE_URL'].flatMap((key) =>
      [null, 1, true, ['x']].map((value) => ({ code: env({ [key]: value }), filename: project })),
    ),
    // Variables that do not route traffic.
    { code: env({ ANTHROPIC_MODEL: 'opus', NO_PROXY: 'localhost' }), filename: project },
    // The endpoint of OpenTelemetry is for `settings-env-ignored-var`, so there is one report.
    { code: env({ OTEL_EXPORTER_OTLP_ENDPOINT: 'https://otel.example.com' }), filename: project },
    // No `env` block, or a block that is no object.
    { code: '{}', filename: project },
    { code: JSON.stringify({ env: [] }), filename: project },
    // Two keys of one name: the last counts, as in `JSON.parse`.
    { code: '{"env": {"HTTPS_PROXY": "http://p:1", "HTTPS_PROXY": ""}}', filename: project },
  ],
  invalid: [
    ...TRAFFIC.map((key) => ({
      code: env({ [key]: 'http://proxy.example.com:3128' }),
      filename: project,
      errors: [{ messageId: 'traffic' as const }],
    })),
    // Any non-empty value is a fault for a proxy variable.
    {
      code: env({ HTTP_PROXY: '0' }),
      filename: project,
      errors: [{ messageId: 'traffic' as const }],
    },
    // Each brace variant of `CLAUDE_CODE_USE_*`, with each on value in any casing.
    ...PROVIDERS.flatMap((key) =>
      ['1', 'true', 'YES', 'On'].map((value) => ({
        code: env({ [key]: value }),
        filename: project,
        errors: [{ messageId: 'bypass' as const }],
      })),
    ),
    // A base URL with another host, and a text that is no URL.
    ...[
      'https://gateway.example.com',
      'http://localhost:4000',
      'api.anthropic.com',
      'not a url',
    ].map((value) => ({
      code: env({ ANTHROPIC_BASE_URL: value }),
      filename: project,
      errors: [{ messageId: 'bypass' as const }],
    })),
    // The report is on the variable name.
    {
      code: '{\n  "env": {\n    "HTTPS_PROXY": "http://p:1"\n  }\n}',
      filename: project,
      errors: [{ messageId: 'traffic' as const, line: 3, column: 5 }],
    },
    // Each variable gets its own report, and two keys of one name give one.
    {
      code: '{"env": {"HTTPS_PROXY": "http://p:1", "HTTPS_PROXY": "http://q:1", "CLAUDE_CODE_USE_VERTEX": "1"}}',
      filename: project,
      errors: [{ messageId: 'traffic' as const }, { messageId: 'bypass' as const }],
    },
  ],
})

describe('settings-env-routing: messages', () => {
  const text = (value: object) =>
    lintJson('settings-env-routing', env(value), `/repo/${project}`)[0]?.message

  it('says that a provider or a gateway bypasses server-managed settings', () => {
    expect(text({ CLAUDE_CODE_USE_BEDROCK: '1' })).toContain('bypasses server-managed settings')
    expect(text({ ANTHROPIC_BASE_URL: 'https://g.example.com' })).toContain(
      'bypasses server-managed settings',
    )
  })

  it('names the variable', () => {
    expect(text({ HTTPS_PROXY: 'http://p:1' })).toContain('"HTTPS_PROXY"')
  })
})

describe('settings-env-routing: one report for one fault', () => {
  it('leaves the OpenTelemetry endpoint to settings-env-ignored-var', () => {
    expect(envIgnoredIn('OTEL_EXPORTER_OTLP_ENDPOINT')).toBe('project-files')
  })
})
