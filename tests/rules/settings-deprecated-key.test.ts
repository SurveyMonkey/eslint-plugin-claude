// The expected values come from the settings reference
// (https://code.claude.com/docs/en/settings-reference): the entries of `includeCoAuthoredBy`,
// `voiceEnabled` and `disableArtifact`, and the `attribution` entry.
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import {
  DEPRECATED_KEYS,
  IGNORED_FALSE_KEYS,
  NO_EFFECT_KEYS,
  SUPERSEDED_KEYS,
} from '../../src/data/settings-keys.ts'
import plugin from '../../src/index.ts'
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-deprecated-key')

const project = '.claude/settings.json'
const local = '.claude/settings.local.json'
const managed = 'managed-settings.json'
const dropIn = 'managed-settings.d/10-x.json'
const ALL = [project, local, managed, dropIn]
const obj = (value: object) => JSON.stringify(value)

jsonTester.run('settings-deprecated-key (valid)', rule, {
  valid: [
    // A key that Claude Code does not deprecate.
    ...ALL.map((filename) => ({
      code: obj({ attribution: { commit: '' }, voice: { enabled: true }, enableArtifact: false }),
      filename,
    })),
    // Claude Code ignores `disableArtifact: false`. `settings-removed-key` reports it.
    ...ALL.map((filename) => ({ code: '{"disableArtifact": false}', filename })),
    // A value of another type is for `settings-schema`.
    ...ALL.flatMap((filename) =>
      ['"true"', '0', '[true]', '{}'].map((value) => ({
        code: `{"disableArtifact": ${value}}`,
        filename,
      })),
    ),
    // Claude Code ignores `includeCoAuthoredBy` and `voiceEnabled` once the replacement key is set.
    // `settings-removed-key` reports them.
    ...ALL.flatMap((filename) =>
      [
        { includeCoAuthoredBy: false, attribution: { commit: 'x' } },
        { includeCoAuthoredBy: true, attribution: { pr: '' } },
        { voiceEnabled: true, voice: { enabled: false } },
      ].map((settings) => ({ code: obj(settings), filename })),
    ),
    // A `null` is no value, for the key and for its replacement.
    ...ALL.map((filename) => ({
      code: obj({ includeCoAuthoredBy: null, voiceEnabled: null, disableArtifact: null }),
      filename,
    })),
    // `ignorePatterns` is deprecated too. `permissions-ignore-patterns` owns it.
    ...ALL.map((filename) => ({ code: '{"ignorePatterns": ["a"]}', filename })),
    // The key inside a value that the rule does not read is no settings key.
    ...ALL.map((filename) => ({
      code: obj({ env: { voiceEnabled: '1' }, sandbox: { includeCoAuthoredBy: true } }),
      filename,
    })),
    // The last of two keys of one name counts.
    { code: '{"disableArtifact": true, "disableArtifact": false}', filename: project },
    // A hidden drop-in is not a settings file for Claude Code.
    { code: '{"voiceEnabled": true}', filename: 'managed-settings.d/.10-x.json' },
    { code: '{"voiceEnabled": true}', filename: 'etc/managed-settings.d/.10-x.json' },
    // A value that is not an object has no keys.
    ...ALL.flatMap((filename) => ['[1]', '"x"', 'null', '1'].map((code) => ({ code, filename }))),
  ],
  invalid: [],
})

jsonTester.run('settings-deprecated-key (invalid)', rule, {
  valid: [],
  invalid: [
    // `includeCoAuthoredBy` of any value, when nothing replaces it. The report is on the key.
    ...ALL.flatMap((filename) =>
      ['true', 'false'].map((value) => ({
        code: `{"includeCoAuthoredBy": ${value}}`,
        filename,
        errors: [
          {
            messageId: 'deprecated' as const,
            data: { key: 'includeCoAuthoredBy', use: '"attribution"' },
            line: 1,
            column: 2,
            endColumn: 23,
          },
        ],
      })),
    ),
    // `voiceEnabled` of any value, when `voice.enabled` is not set.
    ...ALL.flatMap((filename) =>
      ['true', 'false'].map((value) => ({
        code: `{"voiceEnabled": ${value}}`,
        filename,
        errors: [
          {
            messageId: 'deprecated' as const,
            data: { key: 'voiceEnabled', use: '"voice.enabled"' },
            line: 1,
            column: 2,
            endColumn: 16,
          },
        ],
      })),
    ),
    // `disableArtifact: true` still works. The report is on the key.
    ...ALL.map((filename) => ({
      code: '{"disableArtifact": true}',
      filename,
      errors: [
        {
          messageId: 'deprecated' as const,
          data: { key: 'disableArtifact', use: '"enableArtifact": false' },
          line: 1,
          column: 2,
          endColumn: 19,
        },
      ],
    })),
    // The key still works when the replacement key is not set: a `null`, a key at the wrong level,
    // and a value that is not an object.
    ...[
      { includeCoAuthoredBy: false, attribution: { commit: null, pr: null } },
      { includeCoAuthoredBy: false, attribution: { sessionUrl: false } },
      { includeCoAuthoredBy: false, attribution: 'x' },
      { includeCoAuthoredBy: false, commit: 'x' },
      { includeCoAuthoredBy: false, attribution: false },
    ].map((settings) => ({
      code: obj(settings),
      filename: project,
      errors: [{ messageId: 'deprecated' as const }],
    })),
    ...[
      { voiceEnabled: true, voice: { enabled: null } },
      { voiceEnabled: true, voice: { mode: 'tap' } },
      { voiceEnabled: true, voice: [1] },
      { voiceEnabled: true, enabled: true },
    ].map((settings) => ({
      code: obj(settings),
      filename: project,
      errors: [{ messageId: 'deprecated' as const }],
    })),
    // The three keys together: one report for each, in the order of the file.
    {
      code: obj({ disableArtifact: true, voiceEnabled: true, includeCoAuthoredBy: true }),
      filename: project,
      errors: [
        {
          messageId: 'deprecated' as const,
          data: { key: 'disableArtifact', use: '"enableArtifact": false' },
        },
        { messageId: 'deprecated' as const, data: { key: 'voiceEnabled', use: '"voice.enabled"' } },
        {
          messageId: 'deprecated' as const,
          data: { key: 'includeCoAuthoredBy', use: '"attribution"' },
        },
      ],
    },
    // The last of two keys of one name counts.
    {
      code: '{"disableArtifact": false, "disableArtifact": true}',
      filename: project,
      errors: [{ messageId: 'deprecated' as const, line: 1, column: 28 }],
    },
    // A drop-in with the name of a project file is a managed file.
    {
      code: '{"voiceEnabled": true}',
      filename: 'managed-settings.d/settings.local.json',
      errors: [{ messageId: 'deprecated' as const }],
    },
    // A hidden name outside the directory is no drop-in.
    {
      code: '{"voiceEnabled": true}',
      filename: '.claude/.settings.local.json',
      errors: [{ messageId: 'deprecated' as const }],
    },
  ],
})

// One fault gets one report: this rule and `settings-removed-key` never report the same key.
describe('settings-deprecated-key with settings-removed-key', () => {
  const OWNERS = [
    'claude/recommended/settings-deprecated-key',
    'claude/recommended/settings-removed-key',
  ]
  const lint = (settings: object, filename: string) =>
    new Linter().verify(
      JSON.stringify(settings),
      plugin.configs.recommended.filter((c) => OWNERS.includes(c.name ?? '')),
      { filename },
    )

  it.each([
    [{ includeCoAuthoredBy: false }, ['settings-deprecated-key']],
    [{ includeCoAuthoredBy: false, attribution: { commit: 'x' } }, ['settings-removed-key']],
    [{ voiceEnabled: true }, ['settings-deprecated-key']],
    [{ voiceEnabled: true, voice: { enabled: true } }, ['settings-removed-key']],
    [{ disableArtifact: true }, ['settings-deprecated-key']],
    [{ disableArtifact: false }, ['settings-removed-key']],
  ] as const)('reports %j once', (settings, rules) => {
    for (const filename of ALL) {
      expect(lint(settings, filename).map((m) => m.ruleId)).toEqual(
        rules.map((rule) => `claude/${rule}`),
      )
    }
  })
})

describe('DEPRECATED_KEYS', () => {
  const keys = Object.keys(DEPRECATED_KEYS)

  it('gives each key a test for when Claude Code honors it', () => {
    for (const key of keys) {
      expect(IGNORED_FALSE_KEYS.includes(key) || key in SUPERSEDED_KEYS, key).toBe(true)
    }
  })

  it('shares no key with the keys that have no effect, and has no ignorePatterns', () => {
    for (const key of keys) {
      expect(key in NO_EFFECT_KEYS, key).toBe(false)
    }
    expect(keys).not.toContain('ignorePatterns')
  })
})
