// The expected values come from the `autoContinueAtUsageLimit` entry of the settings reference
// (https://code.claude.com/docs/en/settings-reference#autocontinueatusagelimit): the type is
// Boolean, the scope is "User or managed", and a project or local file that sets the key turns
// the feature off.
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-project-autocontinue-off')

const project = '.claude/settings.json'
const local = '.claude/settings.local.json'
const managed = 'managed-settings.json'
const dropIn = 'managed-settings.d/10-x.json'
const PROJECT_FILES = [project, local]
const MANAGED = [managed, dropIn]

jsonTester.run('settings-project-autocontinue-off (valid)', rule, {
  valid: [
    // A Boolean in a managed file is the scope that the docs give.
    ...MANAGED.flatMap((filename) =>
      ['true', 'false'].map((value) => ({
        code: `{"autoContinueAtUsageLimit": ${value}}`,
        filename,
      })),
    ),
    // A `null` is no value, in each file.
    ...[...PROJECT_FILES, ...MANAGED].map((filename) => ({
      code: '{"autoContinueAtUsageLimit": null}',
      filename,
    })),
    // The key at the wrong level, and inside another value, is another key.
    ...[...PROJECT_FILES, ...MANAGED].map((filename) => ({
      code: '{"env": {"autoContinueAtUsageLimit": false}, "worktree": {"autoContinueAtUsageLimit": 1}}',
      filename,
    })),
    // The last of two keys of one name counts.
    {
      code: '{"autoContinueAtUsageLimit": false, "autoContinueAtUsageLimit": null}',
      filename: project,
    },
    // A hidden drop-in is not a settings file for Claude Code.
    { code: '{"autoContinueAtUsageLimit": "x"}', filename: 'managed-settings.d/.10-x.json' },
    { code: '{"autoContinueAtUsageLimit": 1}', filename: 'etc/managed-settings.d/.10-x.json' },
    // A value that is not an object has no keys.
    ...[...PROJECT_FILES, ...MANAGED].flatMap((filename) =>
      ['[1]', '"x"', 'null', '1'].map((code) => ({ code, filename })),
    ),
  ],
  invalid: [],
})

jsonTester.run('settings-project-autocontinue-off (invalid)', rule, {
  valid: [],
  invalid: [
    // A Boolean of either value in a project or local file turns the feature off. The report is
    // on the value.
    ...PROJECT_FILES.flatMap((filename) =>
      ['true', 'false'].map((value) => ({
        code: `{"autoContinueAtUsageLimit": ${value}}`,
        filename,
        errors: [
          {
            messageId: 'turnsOff' as const,
            line: 1,
            column: 30,
            endColumn: 30 + value.length,
          },
        ],
      })),
    ),
    // A value that is not a Boolean is a type fault in each file. The file kind does not add a
    // second report.
    ...[...PROJECT_FILES, ...MANAGED].flatMap((filename) =>
      ['"false"', '0', '[true]', '{}'].map((value) => ({
        code: `{"autoContinueAtUsageLimit": ${value}}`,
        filename,
        errors: [{ messageId: 'wrongType' as const, line: 1, column: 30 }],
      })),
    ),
    // The last of two keys of one name counts.
    {
      code: '{"autoContinueAtUsageLimit": null, "autoContinueAtUsageLimit": true}',
      filename: project,
      errors: [{ messageId: 'turnsOff' as const, line: 1, column: 64 }],
    },
    // A drop-in with the name of a project file is a managed file, so a Boolean is silent there.
    {
      code: '{"autoContinueAtUsageLimit": 1}',
      filename: 'managed-settings.d/settings.local.json',
      errors: [{ messageId: 'wrongType' as const }],
    },
  ],
})

// One fault gets one report: `settings-key-scope` and `settings-schema` skip this key.
describe('settings-project-autocontinue-off with its neighbours', () => {
  const OWNERS = [
    'claude/recommended/settings-project-autocontinue-off',
    'claude/recommended/settings-key-scope',
    'claude/recommended/settings-schema',
  ]
  const lint = (value: unknown, filename: string) =>
    new Linter().verify(
      JSON.stringify({ autoContinueAtUsageLimit: value }),
      plugin.configs.recommended.filter((c) => OWNERS.includes(c.name ?? '')),
      { filename },
    )

  it.each([project, local, managed, dropIn])(
    'reports a Boolean in %s once or not at all',
    (file) => {
      const rules = lint(false, file).map((m) => m.ruleId)
      expect(rules).toEqual(
        PROJECT_FILES.includes(file) ? ['claude/settings-project-autocontinue-off'] : [],
      )
    },
  )

  it.each([project, local, managed, dropIn])('reports a string in %s once', (file) => {
    expect(lint('no', file).map((m) => m.ruleId)).toEqual([
      'claude/settings-project-autocontinue-off',
    ])
  })
})
