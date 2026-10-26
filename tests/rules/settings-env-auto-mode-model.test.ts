// The expected values are written by hand from two pages. "Choose the classifier model" says to
// set `CLAUDE_CODE_AUTO_MODE_MODEL` to a full model ID, gives `claude-sonnet-4-6` as the example,
// and says that the full model IDs of a cloud provider work too
// (https://code.claude.com/docs/en/permission-modes#choose-the-classifier-model). Its table "When
// your model doesn't review" says that the default classifier model reviews when you set Claude
// Opus 5, Sonnet 5.5 or Opus 5.5
// (https://code.claude.com/docs/en/permission-modes#when-your-model-doesnt-review). The "Model
// aliases" table gives the aliases (https://code.claude.com/docs/en/model-config#model-aliases).
// The file globs are in `tests/configs.test.ts`.
import { describe, expect, it } from 'vitest'
import { jsonTester, lintJson, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-env-auto-mode-model')

const project = '.claude/settings.json'
const env = (value: unknown) => JSON.stringify({ env: { CLAUDE_CODE_AUTO_MODE_MODEL: value } })

jsonTester.run('settings-env-auto-mode-model (valid)', rule, {
  valid: [
    // The example of the docs, and full IDs of models that the docs do not name as ignored. Opus
    // 5.1 and Sonnet 5 are near misses of Opus 5 and Sonnet 5.5.
    ...[
      'claude-sonnet-4-6',
      'claude-opus-4-8',
      'claude-opus-5-1',
      'claude-sonnet-5',
      'claude-haiku-5-5',
      'claude-fable-5-1',
      'claude-sonnet-4-6[1m]',
    ].map((value) => ({ code: env(value), filename: project })),
    // Provider IDs of a model that the classifier uses: Amazon Bedrock, Google Cloud's Agent
    // Platform, a Bedrock ARN and a gateway name. The rule accepts each form as text.
    ...[
      'us.anthropic.claude-sonnet-4-6',
      'claude-sonnet-4-5@20250929',
      'arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/abc123',
      'my-gateway/claude-opus-4-8',
      'gateway-model',
    ].map((value) => ({ code: env(value), filename: project })),
    // An empty value. A different letter case is not an alias that the docs name.
    { code: env(''), filename: project },
    { code: env('SONNET'), filename: project },
    // A value that is not a string is for `settings-env-value-format`.
    ...[1, true, null, ['sonnet'], { model: 'sonnet' }].map((value) => ({
      code: env(value),
      filename: project,
    })),
    // An alias in another model variable is for other rules.
    { code: JSON.stringify({ env: { ANTHROPIC_MODEL: 'sonnet' } }), filename: project },
    // No env block, a block that is no object, and a file that is no object.
    { code: '{}', filename: project },
    { code: JSON.stringify({ env: 'sonnet' }), filename: project },
    { code: '[1]', filename: project },
    // Two keys of one name: the last counts, as in `JSON.parse`.
    {
      code: '{"env": {"CLAUDE_CODE_AUTO_MODE_MODEL": "sonnet", "CLAUDE_CODE_AUTO_MODE_MODEL": "claude-sonnet-4-6"}}',
      filename: project,
    },
    {
      code: '{"env": {"CLAUDE_CODE_AUTO_MODE_MODEL": "sonnet"}, "env": {}}',
      filename: project,
    },
    // Claude Code does not read a hidden drop-in.
    { code: env('sonnet'), filename: 'managed-settings.d/.10-a.json' },
  ],
  invalid: [],
})

jsonTester.run('settings-env-auto-mode-model (invalid)', rule, {
  valid: [],
  invalid: [
    // Each name of the "Model aliases" table, with the `[1m]` spellings. `default` is not an
    // alias, and it is not a full model ID either.
    ...[
      'opus',
      'sonnet',
      'haiku',
      'fable',
      'best',
      'opusplan',
      'default',
      'sonnet[1m]',
      'opus[1m]',
    ].map((value) => ({
      code: env(value),
      filename: project,
      errors: [{ messageId: 'alias' as const }],
    })),
    // Each model that the docs name as ignored, as a full ID, a dated ID, an ID with `[1m]`, and a
    // provider ID that embeds the name.
    ...[
      'claude-opus-5',
      'claude-sonnet-5-5',
      'claude-opus-5-5',
      'claude-opus-5-20260401',
      'claude-opus-5-5[1m]',
      'us.anthropic.claude-opus-5-5',
      'claude-sonnet-5-5@20261001',
    ].map((value) => ({
      code: env(value),
      filename: project,
      errors: [{ messageId: 'ignored' as const }],
    })),
    // The local file and the managed files.
    ...['.claude/settings.local.json', 'managed-settings.json', 'managed-settings.d/10-a.json'].map(
      (filename) => ({
        code: env('claude-opus-5'),
        filename,
        errors: [{ messageId: 'ignored' as const }],
      }),
    ),
    // The report is on the value.
    {
      code: '{\n  "env": {\n    "CLAUDE_CODE_AUTO_MODE_MODEL": "sonnet"\n  }\n}',
      filename: project,
      errors: [{ messageId: 'alias', line: 3, column: 36, endLine: 3, endColumn: 44 }],
    },
  ],
})

describe('settings-env-auto-mode-model: messages', () => {
  const messages = (code: string) =>
    lintJson('settings-env-auto-mode-model', code, `/repo/${project}`).map((m) => m.message)

  it('names the alias and the example ID of the docs', () => {
    const [message] = messages(env('sonnet'))
    expect(message).toContain('"sonnet"')
    expect(message).toContain('full model ID')
    expect(message).toContain('"claude-sonnet-4-6"')
  })

  it('names the ignored model and the default classifier model', () => {
    const [message] = messages(env('claude-opus-5'))
    expect(message).toContain('"claude-opus-5"')
    expect(message).toContain('default classifier model')
  })
})
