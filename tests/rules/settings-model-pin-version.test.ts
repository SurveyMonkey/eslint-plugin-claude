// The expected values come from the model configuration page
// (https://code.claude.com/docs/en/model-config). "Aliases point to the recommended version for
// your provider and update over time." The page pins an alias with `ANTHROPIC_DEFAULT_*_MODEL`.
// For `availableModels` on a third-party provider, "Provider-specific prefixes such as
// `us.anthropic.` are not stripped", so a bare Anthropic ID may not match. The rule reads the
// shared project file for the alias, and that file and the managed files for the allowlist. The
// file globs are in `tests/configs.test.ts`.
import { describe, expect, it } from 'vitest'
import { jsonTester, lintJson, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-model-pin-version')

const project = '.claude/settings.json'
const managed = 'managed-settings.json'
const dropIn = 'managed-settings.d/10-models.json'
const hidden = 'managed-settings.d/.10-models.json'
const bedrock = { CLAUDE_CODE_USE_BEDROCK: '1' }
const settings = (body: object) => JSON.stringify(body)

jsonTester.run('settings-model-pin-version (valid)', rule, {
  valid: [
    // A full model ID, a provider ID and the value that clears the override.
    { code: settings({ model: 'claude-opus-5-5' }), filename: project },
    { code: settings({ model: 'claude-opus-4-6[1m]' }), filename: project },
    { code: settings({ model: 'us.anthropic.claude-opus-4-8' }), filename: project },
    { code: settings({ model: 'default' }), filename: project },
    { code: settings({ model: 'my-gateway-model' }), filename: project },
    // A value that is no string, no model, or an empty string.
    { code: settings({ model: null }), filename: project },
    { code: settings({ model: 7 }), filename: project },
    { code: settings({}), filename: project },
    { code: '[1]', filename: project },
    // An alias that the same file pins in `env`.
    {
      code: settings({ model: 'opus', env: { ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-5-5' } }),
      filename: project,
    },
    {
      code: settings({
        model: 'sonnet[1m]',
        env: { ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-6' },
      }),
      filename: project,
    },
    {
      code: settings({
        model: 'opusplan',
        env: {
          ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-5-5',
          ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-5-5',
        },
      }),
      filename: project,
    },
    {
      code: settings({
        model: 'best',
        env: {
          ANTHROPIC_DEFAULT_FABLE_MODEL: 'claude-fable-5-1',
          ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-5-5',
        },
      }),
      filename: project,
    },
    // The alias half reads the shared project file only: a managed policy and a local file hold
    // the choice of one party.
    { code: settings({ model: 'opus' }), filename: managed },
    { code: settings({ model: 'opus' }), filename: dropIn },
    // A hidden drop-in is ignored by Claude Code.
    {
      code: settings({ env: bedrock, availableModels: ['claude-opus-4-8'], model: 'opus' }),
      filename: hidden,
    },
    // The allowlist half: a provider-form ID, an alias, a version prefix of an alias, or no
    // Bedrock in the file.
    {
      code: settings({ env: bedrock, availableModels: ['us.anthropic.claude-opus-4-8', 'sonnet'] }),
      filename: managed,
    },
    { code: settings({ availableModels: ['claude-opus-4-8'] }), filename: managed },
    {
      code: settings({
        env: { CLAUDE_CODE_USE_BEDROCK: '0' },
        availableModels: ['claude-opus-4-8'],
      }),
      filename: managed,
    },
    {
      code: settings({
        env: { CLAUDE_CODE_USE_VERTEX: '1' },
        availableModels: ['claude-opus-4-8'],
      }),
      filename: managed,
    },
    {
      code: settings({ env: { CLAUDE_CODE_USE_BEDROCK: 1 }, availableModels: ['claude-opus-4-8'] }),
      filename: managed,
    },
    // An entry that is no string, or a list that is no array.
    { code: settings({ env: bedrock, availableModels: [7, null] }), filename: managed },
    { code: settings({ env: bedrock, availableModels: 'claude-opus-4-8' }), filename: managed },
    // The page compares the allowlist with the Anthropic ID of an overridden model.
    {
      code: settings({
        env: bedrock,
        availableModels: ['claude-opus-4-7'],
        modelOverrides: { 'claude-opus-4-7': 'arn:aws:bedrock:us-east-2:123456789012:x' },
      }),
      filename: managed,
    },
  ],
  invalid: [
    {
      code: '{\n  "model": "opus"\n}',
      filename: project,
      errors: [{ messageId: 'alias', line: 2, column: 12 }],
    },
    { code: settings({ model: 'sonnet' }), filename: project, errors: [{ messageId: 'alias' }] },
    { code: settings({ model: 'haiku' }), filename: project, errors: [{ messageId: 'alias' }] },
    { code: settings({ model: 'fable' }), filename: project, errors: [{ messageId: 'alias' }] },
    { code: settings({ model: 'opus[1m]' }), filename: project, errors: [{ messageId: 'alias' }] },
    { code: settings({ model: 'best' }), filename: project, errors: [{ messageId: 'alias' }] },
    { code: settings({ model: 'opusplan' }), filename: project, errors: [{ messageId: 'alias' }] },
    // One family of two is not pinned.
    {
      code: settings({
        model: 'opusplan',
        env: { ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-5-5' },
      }),
      filename: project,
      errors: [{ messageId: 'alias' }],
    },
    // A pin with an empty value pins nothing, and a pin of another family does not help.
    {
      code: settings({ model: 'opus', env: { ANTHROPIC_DEFAULT_OPUS_MODEL: '' } }),
      filename: project,
      errors: [{ messageId: 'alias' }],
    },
    {
      code: settings({
        model: 'opus',
        env: { ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-5-5' },
      }),
      filename: project,
      errors: [{ messageId: 'alias' }],
    },
    {
      code: settings({ model: 'opus', env: { ANTHROPIC_DEFAULT_OPUS_MODEL: 5 } }),
      filename: project,
      errors: [{ messageId: 'alias' }],
    },
    // A provider allowlist entry without the prefix, in the shared file and in managed files.
    {
      code: settings({ env: bedrock, availableModels: ['claude-opus-4-8'] }),
      filename: project,
      errors: [{ messageId: 'noPrefix' }],
    },
    {
      code: settings({
        env: { CLAUDE_CODE_USE_BEDROCK: 'true' },
        availableModels: ['claude-opus-4-8[1m]', 'sonnet'],
      }),
      filename: managed,
      errors: [{ messageId: 'noPrefix' }],
    },
    {
      code: settings({
        env: bedrock,
        availableModels: ['claude-opus-4-8', 'us.anthropic.claude-sonnet-5-5', 'claude-haiku-5-5'],
      }),
      filename: dropIn,
      errors: [{ messageId: 'noPrefix' }, { messageId: 'noPrefix' }],
    },
    // A `modelOverrides` key for another model does not exempt the entry.
    {
      code: settings({
        env: bedrock,
        availableModels: ['claude-opus-4-8'],
        modelOverrides: { 'claude-opus-4-7': 'arn:x' },
      }),
      filename: managed,
      errors: [{ messageId: 'noPrefix' }],
    },
    // The two halves report on one file.
    {
      code: settings({ model: 'opus', env: bedrock, availableModels: ['claude-opus-4-8'] }),
      filename: project,
      errors: [{ messageId: 'alias' }, { messageId: 'noPrefix' }],
    },
  ],
})

describe('settings-model-pin-version: messages', () => {
  const messages = (code: string, file: string) =>
    lintJson('settings-model-pin-version', code, `/repo/${file}`).map((m) => m.message)

  it('names the alias and the variable that pins it', () => {
    expect(messages(settings({ model: 'opusplan' }), project)).toEqual([
      'The model "opusplan" is an alias, and an alias moves to a newer model over time. Name a full model ID, or pin the alias in "env" with "ANTHROPIC_DEFAULT_OPUS_MODEL".',
    ])
  })

  it('names the variable of the family that the file leaves unpinned', () => {
    const code = settings({
      model: 'best',
      env: { ANTHROPIC_DEFAULT_FABLE_MODEL: 'claude-fable-5-1' },
    })
    expect(messages(code, project)).toEqual([
      expect.stringContaining('"ANTHROPIC_DEFAULT_OPUS_MODEL"'),
    ])
  })

  it('names the entry of the allowlist', () => {
    const [message] = messages(
      settings({ env: bedrock, availableModels: ['claude-opus-4-8'] }),
      managed,
    )
    expect(message).toContain('"claude-opus-4-8"')
    expect(message).toContain('"us.anthropic."')
  })
})
