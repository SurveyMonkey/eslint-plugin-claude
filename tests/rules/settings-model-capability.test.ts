// The expected values come from the model configuration page
// (https://code.claude.com/docs/en/model-config). "Extended context": Fable, Sonnet 5 and later,
// Haiku 5.5, Opus 4.6 and later, and Sonnet 4.6 have a 1M window; the `[1m]` suffix is for the
// ones that reach it by the suffix. "Extended thinking": "You can't turn thinking off on Opus 5.5,
// Sonnet 5.5, Haiku 5.5, or the Fable models", and a saved `alwaysThinkingEnabled: false` or
// `MAX_THINKING_TOKENS=0` has no effect there. "Adaptive reasoning": Fable, Sonnet 5 and later,
// Haiku 5.5 and Opus 4.7 and later ignore `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING`. An alias
// resolves to the model of the table for the Anthropic API. The file globs are in
// `tests/configs.test.ts`.
import { describe, expect, it } from 'vitest'
import { jsonTester, lintJson, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-model-capability')

const project = '.claude/settings.json'
const local = '.claude/settings.local.json'
const managed = 'managed-settings.json'
const hidden = 'managed-settings.d/.10-model.json'
const settings = (body: object) => JSON.stringify(body)
const env = (variables: object, more: object = {}) => settings({ env: variables, ...more })

jsonTester.run('settings-model-capability (valid)', rule, {
  valid: [
    // `[1m]` on a model with a 1M window by the suffix, and on one with a native window.
    ...[
      'claude-opus-4-6[1m]',
      'claude-sonnet-4-6[1m]',
      'claude-opus-4-7[1m]',
      'claude-opus-5-5[1m]',
    ].map((model) => ({ code: settings({ model }), filename: project })),
    ...['claude-sonnet-5[1m]', 'claude-haiku-5-5[1m]', 'claude-fable-5-1[1m]'].map((model) => ({
      code: settings({ model }),
      filename: project,
    })),
    // An alias, a provider ID with no name the rule can read, and an ID without the suffix.
    { code: settings({ model: 'sonnet[1m]' }), filename: project },
    { code: settings({ model: 'haiku[1m]' }), filename: project },
    { code: settings({ model: 'arn:aws:bedrock:us:1:model/x[1m]' }), filename: project },
    { code: settings({ model: 'claude-haiku-4-5' }), filename: project },
    { code: settings({ model: 'claude-sonnet-4-5-20250929' }), filename: project },
    // Values that are no strings.
    { code: settings({ model: 7, fallbackModel: null, availableModels: [1] }), filename: project },
    { code: settings({ availableModels: 'claude-sonnet-4-5[1m]' }), filename: project },
    { code: env({ ANTHROPIC_MODEL: 7, ANTHROPIC_DEFAULT_OPUS_MODEL: null }), filename: project },
    { code: settings({ env: 'x' }), filename: project },
    { code: '[1]', filename: project },
    // Thinking off, with a model that accepts it.
    { code: settings({ model: 'claude-opus-5', alwaysThinkingEnabled: false }), filename: project },
    {
      code: settings({ model: 'claude-opus-4-6', alwaysThinkingEnabled: false }),
      filename: project,
    },
    {
      code: settings({ model: 'claude-sonnet-4-5', alwaysThinkingEnabled: false }),
      filename: project,
    },
    {
      code: settings({ model: 'claude-haiku-4-5', alwaysThinkingEnabled: false }),
      filename: project,
    },
    {
      code: settings({ model: 'claude-opus-5-6', alwaysThinkingEnabled: false }),
      filename: project,
    },
    {
      code: settings({ model: 'claude-opus-5-5', alwaysThinkingEnabled: true }),
      filename: project,
    },
    {
      code: settings({ model: 'claude-opus-5-5', alwaysThinkingEnabled: 'false' }),
      filename: project,
    },
    // No model in the file: the default model of the account is unknown.
    { code: settings({ alwaysThinkingEnabled: false }), filename: project },
    { code: settings({ model: '', alwaysThinkingEnabled: false }), filename: project },
    { code: settings({ model: 'default', alwaysThinkingEnabled: false }), filename: project },
    { code: settings({ model: 7, alwaysThinkingEnabled: false }), filename: project },
    // An alias that depends on the provider, or that names two models.
    ...['best', 'opusplan'].map((model) => ({
      code: settings({ model, alwaysThinkingEnabled: false }),
      filename: project,
    })),
    {
      code: env(
        { CLAUDE_CODE_USE_BEDROCK: '1' },
        { model: 'sonnet', alwaysThinkingEnabled: false },
      ),
      filename: project,
    },
    // An alias pinned to a model that accepts it, or to an ID the rule cannot read.
    {
      code: env(
        { ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-6' },
        { model: 'opus', alwaysThinkingEnabled: false },
      ),
      filename: project,
    },
    {
      code: env(
        { ANTHROPIC_DEFAULT_OPUS_MODEL: 'arn:aws:bedrock:us:1:model/x' },
        { model: 'opus', alwaysThinkingEnabled: false },
      ),
      filename: project,
    },
    // The adaptive switch on a model that does not always use adaptive reasoning, at the edge of
    // the Haiku line.
    {
      code: env(
        { CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING: '1' },
        { model: 'claude-haiku-5-4', alwaysThinkingEnabled: false },
      ),
      filename: project,
    },
    // `MAX_THINKING_TOKENS` other than zero, or of another type.
    { code: env({ MAX_THINKING_TOKENS: '8000' }, { model: 'claude-opus-5-5' }), filename: project },
    { code: env({ MAX_THINKING_TOKENS: 0 }, { model: 'claude-opus-5-5' }), filename: project },
    { code: env({ MAX_THINKING_TOKENS: '0' }, { model: 'claude-opus-4-6' }), filename: project },
    { code: env({ MAX_THINKING_TOKENS: '' }, { model: 'claude-opus-5-5' }), filename: project },
    // The adaptive switch off, or on a model that accepts it.
    {
      code: env({ CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING: '0' }, { model: 'claude-opus-5-5' }),
      filename: project,
    },
    {
      code: env({ CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING: '1' }, { model: 'claude-opus-4-6' }),
      filename: project,
    },
    {
      code: env({ CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING: '1' }, { model: 'claude-sonnet-4-6' }),
      filename: project,
    },
    {
      code: env({ CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING: '1' }, { model: 'claude-haiku-4-5' }),
      filename: project,
    },
    {
      code: env({ CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING: true }, { model: 'claude-opus-5-5' }),
      filename: project,
    },
    // A hidden drop-in is ignored by Claude Code.
    {
      code: settings({ model: 'claude-opus-5-5', alwaysThinkingEnabled: false }),
      filename: hidden,
    },
  ],
  invalid: [
    {
      code: '{\n  "model": "claude-sonnet-4-5[1m]"\n}',
      filename: project,
      errors: [{ messageId: 'noMillion', line: 2, column: 12 }],
    },
    // The families and versions that have no 1M window.
    ...[
      'claude-sonnet-4-5[1m]',
      'claude-sonnet-4-5-20250929[1m]',
      'claude-sonnet-4[1m]',
      'claude-sonnet-4-20250514[1m]',
      'claude-opus-4-5[1m]',
      'claude-opus-4-1-20250805[1m]',
      'claude-opus-4-0[1m]',
      'claude-haiku-4-5[1m]',
      'claude-haiku-5-4[1m]',
      'claude-3-5-haiku-latest[1m]',
      'claude-3-7-sonnet-20250219[1m]',
      'claude-3-opus-20240229[1m]',
      'us.anthropic.claude-sonnet-4-5-20250929-v1:0[1m]',
    ].map((model) => ({
      code: settings({ model }),
      filename: project,
      errors: [{ messageId: 'noMillion' as const }],
    })),
    // Every place that holds a model.
    {
      code: settings({
        fallbackModel: 'claude-haiku-4-5[1m]',
        availableModels: ['claude-sonnet-4-5[1m]', 'opus', 'claude-opus-4-6[1m]'],
        env: {
          ANTHROPIC_MODEL: 'claude-sonnet-4-5[1m]',
          CLAUDE_CODE_SUBAGENT_MODEL: 'claude-haiku-4-5[1m]',
          ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-5[1m]',
        },
      }),
      filename: managed,
      errors: Array(5).fill({ messageId: 'noMillion' as const }),
    },
    // The local file too.
    {
      code: settings({ model: 'claude-sonnet-4-5[1m]' }),
      filename: local,
      errors: [{ messageId: 'noMillion' }],
    },
    // `alwaysThinkingEnabled: false` with a model that always thinks.
    {
      code: '{\n  "model": "claude-opus-5-5",\n  "alwaysThinkingEnabled": false\n}',
      filename: project,
      errors: [{ messageId: 'thinkingOff', line: 3, column: 28 }],
    },
    ...[
      'claude-sonnet-5-5',
      'claude-haiku-5-5',
      'claude-fable-5',
      'claude-fable-5-1[1m]',
      'us.anthropic.claude-opus-5-5',
    ].map((model) => ({
      code: settings({ model, alwaysThinkingEnabled: false }),
      filename: project,
      errors: [{ messageId: 'thinkingOff' as const }],
    })),
    // An alias resolves to its Anthropic API model. `fable`, `opus`, `sonnet` and `haiku`.
    ...['fable', 'opus', 'sonnet[1m]', 'haiku'].map((model) => ({
      code: settings({ model, alwaysThinkingEnabled: false }),
      filename: project,
      errors: [{ messageId: 'thinkingOff' as const }],
    })),
    // `ANTHROPIC_MODEL` comes before the `model` setting.
    {
      code: env(
        { ANTHROPIC_MODEL: 'claude-opus-5-5' },
        { model: 'claude-opus-4-6', alwaysThinkingEnabled: false },
      ),
      filename: project,
      errors: [{ messageId: 'thinkingOff' }],
    },
    {
      code: env(
        { ANTHROPIC_MODEL: '' },
        { model: 'claude-opus-5-5', alwaysThinkingEnabled: false },
      ),
      filename: project,
      errors: [{ messageId: 'thinkingOff' }],
    },
    // A pin of each family with `[1m]` on a model that has no 1M window.
    ...[
      { variable: 'ANTHROPIC_DEFAULT_FABLE_MODEL', value: 'claude-haiku-4-5[1m]' },
      { variable: 'ANTHROPIC_DEFAULT_OPUS_MODEL', value: 'claude-opus-4-5[1m]' },
      { variable: 'ANTHROPIC_DEFAULT_SONNET_MODEL', value: 'claude-sonnet-4-5[1m]' },
      { variable: 'ANTHROPIC_DEFAULT_HAIKU_MODEL', value: 'claude-haiku-4-5[1m]' },
    ].map(({ variable, value }) => ({
      code: env({ [variable]: value }),
      filename: project,
      errors: [{ messageId: 'noMillion' as const }],
    })),
    // An empty pin is no pin: the alias resolves to its Anthropic API model.
    {
      code: env(
        { ANTHROPIC_DEFAULT_OPUS_MODEL: '' },
        { model: 'opus', alwaysThinkingEnabled: false },
      ),
      filename: project,
      errors: [{ messageId: 'thinkingOff' }],
    },
    // A pin that names a model that always thinks.
    {
      code: env(
        { ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-5-5', CLAUDE_CODE_USE_BEDROCK: '1' },
        { model: 'opus', alwaysThinkingEnabled: false },
      ),
      filename: project,
      errors: [{ messageId: 'thinkingOff' }],
    },
    // A provider variable that is off does not hide the alias.
    {
      code: env({ CLAUDE_CODE_USE_BEDROCK: '0' }, { model: 'opus', alwaysThinkingEnabled: false }),
      filename: project,
      errors: [{ messageId: 'thinkingOff' }],
    },
    // `MAX_THINKING_TOKENS=0`, in a project file and in a managed file.
    {
      code: env({ MAX_THINKING_TOKENS: '0' }, { model: 'claude-sonnet-5-5' }),
      filename: project,
      errors: [{ messageId: 'thinkingOff' }],
    },
    {
      code: env({ MAX_THINKING_TOKENS: '00', ANTHROPIC_MODEL: 'claude-fable-5-1' }),
      filename: managed,
      errors: [{ messageId: 'thinkingOff' }],
    },
    // `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING` with a model that always uses adaptive reasoning.
    {
      code: '{\n  "model": "claude-opus-4-7",\n  "env": {"CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING": "1"}\n}',
      filename: project,
      errors: [{ messageId: 'adaptiveOff', line: 3, column: 52 }],
    },
    ...[
      'claude-opus-4-7',
      'claude-opus-4-8',
      'claude-opus-5',
      'claude-sonnet-5',
      'claude-sonnet-5-5',
      'claude-haiku-5-5',
      'claude-fable-5-1',
    ].map((model) => ({
      code: env({ CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING: 'true' }, { model }),
      filename: project,
      errors: [{ messageId: 'adaptiveOff' as const }],
    })),
    // The three thinking reports on one file.
    {
      code: env(
        { MAX_THINKING_TOKENS: '0', CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING: 'on' },
        { model: 'claude-opus-5-5', alwaysThinkingEnabled: false },
      ),
      filename: project,
      // In file order: the variables of `env` come before the other keys.
      errors: [
        { messageId: 'thinkingOff' },
        { messageId: 'adaptiveOff' },
        { messageId: 'thinkingOff' },
      ],
    },
  ],
})

describe('settings-model-capability: messages', () => {
  const messages = (code: string, file = project) =>
    lintJson('settings-model-capability', code, `/repo/${file}`).map((m) => m.message)

  it('names the model that has no 1M window', () => {
    expect(messages(settings({ model: 'claude-sonnet-4-5[1m]' }))).toEqual([
      'The model "claude-sonnet-4-5[1m]" has no 1M context window, so the "[1m]" suffix has no effect. Use a model with 1M context, or remove the suffix.',
    ])
  })

  it('names the setting and the model that always thinks', () => {
    expect(messages(settings({ model: 'opus', alwaysThinkingEnabled: false }))).toEqual([
      '"alwaysThinkingEnabled" turns thinking off, and Claude Code ignores it on "opus", which always thinks. Remove it, or choose a model that accepts it.',
    ])
    expect(messages(env({ MAX_THINKING_TOKENS: '0' }, { model: 'claude-opus-5-5' }))).toEqual([
      expect.stringContaining('"MAX_THINKING_TOKENS" turns thinking off'),
    ])
  })

  it('names the adaptive switch', () => {
    expect(
      messages(env({ CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING: '1' }, { model: 'claude-opus-4-7' })),
    ).toEqual([
      'Claude Code ignores "CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING" on "claude-opus-4-7", which always uses adaptive reasoning. Remove it, or choose a model that accepts it.',
    ])
  })
})
