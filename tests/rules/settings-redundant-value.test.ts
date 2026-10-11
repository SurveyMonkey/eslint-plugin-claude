// The expected values come from the settings reference
// (https://code.claude.com/docs/en/settings-reference): the entries of `alwaysThinkingEnabled`,
// `enableArtifact`, `syncClaudeAiSkills`, `syncClaudeAiPlugins` and `spinnerVerbs`.
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-redundant-value')

const project = '.claude/settings.json'
const local = '.claude/settings.local.json'
const managed = 'managed-settings.json'
const dropIn = 'managed-settings.d/10-x.json'
const ALL = [project, local, managed, dropIn]
const obj = (value: object) => JSON.stringify(value)

jsonTester.run('settings-redundant-value (valid)', rule, {
  valid: [
    // The value that has an effect.
    ...ALL.map((filename) => ({
      code: obj({
        alwaysThinkingEnabled: false,
        enableArtifact: false,
        syncClaudeAiSkills: false,
        syncClaudeAiPlugins: false,
      }),
      filename,
    })),
    // A value of another type is for `settings-schema`. A `null` is no value.
    ...ALL.flatMap((filename) =>
      ['"true"', '1', 'null', '[true]'].map((value) => ({
        code: `{"alwaysThinkingEnabled": ${value}, "enableArtifact": ${value}}`,
        filename,
      })),
    ),
    // Another rule reports `syncClaudeAiSkills` in the project file, and `syncClaudeAiPlugins` in
    // both project files.
    { code: '{"syncClaudeAiSkills": true}', filename: project },
    { code: '{"syncClaudeAiPlugins": true}', filename: project },
    { code: '{"syncClaudeAiPlugins": true}', filename: local },
    // `spinnerVerbs` that has an effect: `replace` with a verb, `append` with no verb, and a
    // list that is not an array.
    ...ALL.flatMap((filename) =>
      [
        { mode: 'replace', verbs: ['Pondering'] },
        { mode: 'append', verbs: [] },
        { mode: 'replace' },
        { verbs: [] },
        { mode: 'replace', verbs: 'x' },
        { mode: 'replace', verbs: null },
        { mode: ['replace'], verbs: [] },
      ].map((spinnerVerbs) => ({ code: obj({ spinnerVerbs }), filename })),
    ),
    // `spinnerVerbs` that is not an object has no members.
    ...ALL.map((filename) => ({ code: '{"spinnerVerbs": "replace"}', filename })),
    // The last of two keys of one name counts.
    { code: '{"enableArtifact": true, "enableArtifact": false}', filename: project },
    // A hidden drop-in is not a settings file for Claude Code.
    { code: '{"enableArtifact": true}', filename: 'managed-settings.d/.10-x.json' },
    { code: '{"enableArtifact": true}', filename: 'etc/managed-settings.d/.10-x.json' },
    // A value that is not an object has no keys.
    ...ALL.flatMap((filename) => ['[1]', '"x"', 'null', '1'].map((code) => ({ code, filename }))),
  ],
  invalid: [],
})

const REASONS = {
  alwaysThinkingEnabled: 'thinking is on by default',
  enableArtifact: 'it never overrides a false from another file',
  syncClaudeAiSkills: 'Claude Code honors only false',
  syncClaudeAiPlugins: 'Claude Code honors only false',
}

jsonTester.run('settings-redundant-value (invalid)', rule, {
  valid: [],
  invalid: [
    // `true` for a key in each file that no other rule reports. The report is on the value.
    ...(
      [
        ['alwaysThinkingEnabled', ALL],
        ['enableArtifact', ALL],
        ['syncClaudeAiSkills', [local, managed, dropIn]],
        ['syncClaudeAiPlugins', [managed, dropIn]],
      ] as const
    ).flatMap(([key, files]) =>
      files.map((filename) => ({
        code: `{"${key}": true}`,
        filename,
        errors: [
          {
            messageId: 'sameAsUnset' as const,
            data: { key, why: REASONS[key] },
            line: 1,
            column: key.length + 6,
            endColumn: key.length + 10,
          },
        ],
      })),
    ),
    // `spinnerVerbs` in replace mode with an empty list. The report is on the list.
    ...ALL.map((filename) => ({
      code: '{"spinnerVerbs": {"mode": "replace", "verbs": []}}',
      filename,
      errors: [{ messageId: 'emptyReplace' as const, line: 1, column: 47, endColumn: 49 }],
    })),
    // The order of the members does not matter. A list with spaces is still empty.
    {
      code: '{"spinnerVerbs": {"verbs": [ ], "mode": "replace"}}',
      filename: project,
      errors: [{ messageId: 'emptyReplace' as const }],
    },
    // The four keys and `spinnerVerbs` together: one report for each, in the order of the file.
    {
      code: obj({
        spinnerVerbs: { mode: 'replace', verbs: [] },
        enableArtifact: true,
        alwaysThinkingEnabled: true,
      }),
      filename: managed,
      errors: [
        { messageId: 'emptyReplace' as const },
        {
          messageId: 'sameAsUnset' as const,
          data: { key: 'enableArtifact', why: REASONS.enableArtifact },
        },
        {
          messageId: 'sameAsUnset' as const,
          data: { key: 'alwaysThinkingEnabled', why: REASONS.alwaysThinkingEnabled },
        },
      ],
    },
    // The last of two keys of one name counts.
    {
      code: '{"enableArtifact": false, "enableArtifact": true}',
      filename: project,
      errors: [{ messageId: 'sameAsUnset' as const, line: 1, column: 45 }],
    },
    // A drop-in with the name of a project file is a managed file.
    {
      code: '{"syncClaudeAiPlugins": true}',
      filename: 'managed-settings.d/settings.local.json',
      errors: [{ messageId: 'sameAsUnset' as const }],
    },
  ],
})

// One fault gets one report: this rule and the rules that own `syncClaudeAiSkills` and
// `syncClaudeAiPlugins` in a project file never report the same key.
describe('settings-redundant-value with its neighbours', () => {
  const OWNERS = [
    'claude/recommended/settings-redundant-value',
    'claude/recommended/settings-key-scope',
    'claude/recommended/settings-sync-claude-ai-plugins',
  ]
  const lint = (settings: object, filename: string) =>
    new Linter().verify(
      JSON.stringify(settings),
      plugin.configs.recommended.filter((c) => OWNERS.includes(c.name ?? '')),
      { filename },
    )

  it.each([
    ['syncClaudeAiSkills', project, 'settings-key-scope'],
    ['syncClaudeAiSkills', local, 'settings-redundant-value'],
    ['syncClaudeAiSkills', managed, 'settings-redundant-value'],
    ['syncClaudeAiPlugins', project, 'settings-sync-claude-ai-plugins'],
    ['syncClaudeAiPlugins', local, 'settings-sync-claude-ai-plugins'],
    ['syncClaudeAiPlugins', managed, 'settings-redundant-value'],
  ] as const)('reports %s: true in %s once, by %s', (key, filename, owner) => {
    expect(lint({ [key]: true }, filename).map((m) => m.ruleId)).toEqual([`claude/${owner}`])
  })
})
