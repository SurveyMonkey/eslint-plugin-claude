// The expected values come from the settings reference
// (https://code.claude.com/docs/en/settings-reference): the entries of `taskOutputMaxChars`,
// `keybindingFlavor`, `permissionExplainerEnabled`, `teammateDefaultModel`, `disableArtifact`,
// `includeCoAuthoredBy`, `voiceEnabled`, and the `attribution` entry.
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-removed-key')

const project = '.claude/settings.json'
const local = '.claude/settings.local.json'
const managed = 'managed-settings.json'
const dropIn = 'managed-settings.d/10-x.json'
const ALL = [project, local, managed, dropIn]
const obj = (value: object) => JSON.stringify(value)

// The four keys with no effect, with the version from the settings reference.
const NO_EFFECT: [string, unknown, string][] = [
  ['taskOutputMaxChars', 20000, '2.1.277'],
  ['keybindingFlavor', 'readline', '2.1.261'],
  ['permissionExplainerEnabled', false, '2.1.257'],
  ['teammateDefaultModel', 'sonnet', '2.1.234'],
]

// `includeCoAuthoredBy` with `attribution`, and the replacing key that the message names.
const SUPERSEDED: [object, string][] = [
  [{ commit: 'x' }, 'attribution.commit'],
  [{ pr: '' }, 'attribution.pr'],
  // The message names the first replacing key in the order of the data, not of the file.
  [{ commit: 'x', pr: 'y' }, 'attribution.commit'],
  [{ pr: 'y', commit: 'x' }, 'attribution.commit'],
]

jsonTester.run('settings-removed-key (valid)', rule, {
  valid: [
    // A key that Claude Code still acts on.
    ...ALL.map((filename) => ({
      code: obj({ model: 'opus', enableArtifact: false, disableArtifact: true }),
      filename,
    })),
    // `disableArtifact: false` is the only value that Claude Code ignores. A value of another
    // type is for `settings-schema`.
    ...ALL.flatMap((filename) =>
      ['null', '0', '"false"'].map((value) => ({
        code: `{"disableArtifact": ${value}}`,
        filename,
      })),
    ),
    // `includeCoAuthoredBy` and `voiceEnabled` still work when nothing replaces them.
    ...ALL.map((filename) => ({
      code: obj({ includeCoAuthoredBy: false, voiceEnabled: true }),
      filename,
    })),
    // `attribution` without `commit` and `pr`, and `voice` without `enabled`, replace nothing.
    ...ALL.map((filename) => ({
      code: obj({
        includeCoAuthoredBy: false,
        voiceEnabled: true,
        attribution: { sessionUrl: false },
        voice: { mode: 'tap' },
      }),
      filename,
    })),
    // A `null` is no value.
    ...ALL.map((filename) => ({
      code: obj({
        includeCoAuthoredBy: false,
        voiceEnabled: true,
        attribution: { commit: null, pr: null },
        voice: { enabled: null },
      }),
      filename,
    })),
    // The replacing key at the wrong level is another key.
    ...ALL.map((filename) => ({
      code: obj({ includeCoAuthoredBy: false, commit: 'x', pr: '', enabled: true }),
      filename,
    })),
    // `attribution` or `voice` that is not an object has no member.
    ...ALL.map((filename) => ({
      code: obj({ includeCoAuthoredBy: false, voiceEnabled: true, attribution: 'x', voice: [1] }),
      filename,
    })),
    // The key inside a value that the rule does not read is no settings key.
    ...ALL.map((filename) => ({
      code: obj({ env: { taskOutputMaxChars: '1' }, hooks: { keybindingFlavor: [] } }),
      filename,
    })),
    // A top-level key with a dot, and a nested key of the same name, are other keys.
    ...ALL.map((filename) => ({
      code: obj({ sandbox: { taskOutputMaxChars: 1 }, 'a.taskOutputMaxChars': 1 }),
      filename,
    })),
    // Claude Code ignores a hidden drop-in, so it reads no key there.
    { code: obj({ taskOutputMaxChars: 1 }), filename: 'managed-settings.d/.10-x.json' },
    { code: obj({ taskOutputMaxChars: 1 }), filename: 'etc/managed-settings.d/.10-x.json' },
    // A top-level value that is not an object has no keys.
    ...ALL.flatMap((filename) =>
      ['[1]', '"x"', 'null', '1', 'true'].map((code) => ({ code, filename })),
    ),
    // Two keys of one name. The rule reads the last, as `JSON.parse` does.
    { code: '{"disableArtifact": false, "disableArtifact": true}', filename: project },
  ],
  invalid: [],
})

jsonTester.run('settings-removed-key (invalid)', rule, {
  valid: [],
  invalid: [
    // Each key reports in each settings file, on the key.
    ...NO_EFFECT.flatMap(([key, value, since]) =>
      ALL.map((filename) => ({
        code: obj({ model: 'opus', [key]: value }),
        filename,
        errors: [
          {
            messageId: 'noEffect' as const,
            data: { key, since },
            line: 1,
            column: 17,
            endColumn: 17 + key.length + 2,
          },
        ],
      })),
    ),
    // A drop-in with the name of a project file is a managed file.
    ...['managed-settings.d/settings.json', 'managed-settings.d/settings.local.json'].map(
      (filename) => ({
        code: obj({ taskOutputMaxChars: 1 }),
        filename,
        errors: [{ messageId: 'noEffect' as const }],
      }),
    ),
    // A hidden name outside the directory is no drop-in.
    {
      code: obj({ taskOutputMaxChars: 1 }),
      filename: '.claude/.settings.local.json',
      errors: [{ messageId: 'noEffect' as const }],
    },
    // The value of the key does not matter.
    {
      code: obj({ teammateDefaultModel: null }),
      filename: project,
      errors: [{ messageId: 'noEffect' as const }],
    },
    // The report is on the value, `false`. A drop-in reports it too.
    ...ALL.map((filename) => ({
      code: '{"disableArtifact": false}',
      filename,
      errors: [
        {
          messageId: 'falseIgnored' as const,
          data: { key: 'disableArtifact' },
          line: 1,
          column: 21,
          endColumn: 26,
        },
      ],
    })),
    // `includeCoAuthoredBy` with `attribution.commit`, with `attribution.pr`, and with both.
    // The report is on the key, one for each key.
    ...SUPERSEDED.flatMap(([attribution, by]) =>
      ALL.map((filename) => ({
        code: obj({ includeCoAuthoredBy: false, attribution }),
        filename,
        errors: [
          {
            messageId: 'superseded' as const,
            data: { key: 'includeCoAuthoredBy', by },
            line: 1,
            column: 2,
            endColumn: 23,
          },
        ],
      })),
    ),
    // `voiceEnabled` with `voice.enabled`, of either Boolean value.
    ...[true, false].flatMap((enabled) =>
      ALL.map((filename) => ({
        code: obj({ voice: { enabled }, voiceEnabled: true }),
        filename,
        errors: [
          {
            messageId: 'superseded' as const,
            data: { key: 'voiceEnabled', by: 'voice.enabled' },
            line: 1,
            column: 2 + `"voice":{"enabled":${enabled}},`.length,
          },
        ],
      })),
    ),
    // The text of each message.
    {
      code: obj({ taskOutputMaxChars: 1 }),
      filename: project,
      errors: [
        {
          message:
            'Claude Code ignores "taskOutputMaxChars" since v2.1.277. The key has no effect.',
        },
      ],
    },
    {
      code: '{"model": "x", "disableArtifact": false}',
      filename: project,
      errors: [
        {
          message:
            'Claude Code ignores "disableArtifact": false. Remove the key to leave the tool on.',
        },
      ],
    },
    {
      code: obj({ voiceEnabled: true, voice: { enabled: false } }),
      filename: project,
      errors: [
        {
          message:
            'Claude Code ignores "voiceEnabled" when "voice.enabled" is set. Remove "voiceEnabled".',
        },
      ],
    },
    // Two keys of one name. The rule reads the last.
    {
      code: '{"disableArtifact": true, "disableArtifact": false}',
      filename: project,
      errors: [{ messageId: 'falseIgnored' as const, column: 46 }],
    },
    // One report for each key.
    {
      code: obj({ taskOutputMaxChars: 1, keybindingFlavor: 'classic', disableArtifact: false }),
      filename: project,
      errors: [
        { messageId: 'noEffect' as const },
        { messageId: 'noEffect' as const },
        { messageId: 'falseIgnored' as const },
      ],
    },
  ],
})

// `permissionExplainerEnabled` and `teammateDefaultModel` are also Global config keys. This rule
// reports them, and `settings-key-scope` does not, so each key gets one report.
describe('settings-removed-key and settings-key-scope on a removed Global config key', () => {
  const lint = (code: string, filename: string) =>
    new Linter().verify(
      code,
      [
        {
          files: ['**/*.json'],
          plugins: { json, claude: plugin },
          language: 'json/json',
          rules: { 'claude/settings-removed-key': 'error', 'claude/settings-key-scope': 'error' },
        },
      ],
      { filename },
    )

  it.each(['permissionExplainerEnabled', 'teammateDefaultModel'])(
    'gives %s one report, from this rule',
    (key) => {
      for (const filename of ALL) {
        const messages = lint(obj({ [key]: false }), filename)
        expect(messages.map(({ ruleId }) => ruleId)).toEqual(['claude/settings-removed-key'])
      }
    },
  )

  it('leaves a Global config key that was not removed to settings-key-scope', () => {
    const messages = lint(obj({ autoConnectIde: true }), project)
    expect(messages.map(({ ruleId }) => ruleId)).toEqual(['claude/settings-key-scope'])
  })
})
