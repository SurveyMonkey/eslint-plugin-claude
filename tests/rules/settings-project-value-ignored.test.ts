// The expected values come from the entries of the settings reference
// (https://code.claude.com/docs/en/settings-reference): `remoteControlAtStartup`,
// `isolatePeerMachines`, `disableClaudeAiConnectors`, `crossSessionInbound`,
// `spinnerTipsOverride`, `remote.defaultEnvironmentId` and `forceLoginMethod`, and from
// "Exceptions to managed settings precedence" (https://code.claude.com/docs/en/settings).
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-project-value-ignored')

const project = '.claude/settings.json'
const local = '.claude/settings.local.json'
const PROJECT_FILES = [project, local]
// A managed file can set each of these values.
const MANAGED_FILES = [
  'managed-settings.json',
  'managed-settings.d/10-x.json',
  'managed-settings.d/settings.json',
  'managed-settings.d/settings.local.json',
]
const obj = (value: object) => JSON.stringify(value)

jsonTester.run('settings-project-value-ignored (valid)', rule, {
  valid: [
    // The values that Claude Code honors in a project file: a value that makes the session
    // stricter, and a value of another kind.
    ...PROJECT_FILES.map((filename) => ({
      code: obj({
        remoteControlAtStartup: false,
        isolatePeerMachines: true,
        disableClaudeAiConnectors: true,
        crossSessionInbound: 'hold',
        forceLoginMethod: 'claudeai',
        remote: { defaultEnvironmentId: 'env_0123abcd' },
        spinnerTipsOverride: { tips: ['Run /review before a PR'] },
      }),
      filename,
    })),
    ...PROJECT_FILES.map((filename) => ({
      code: obj({ crossSessionInbound: 'refuse', forceLoginMethod: 'console' }),
      filename,
    })),
    // A value of another type is for `settings-schema`.
    ...PROJECT_FILES.map((filename) => ({
      code: obj({
        remoteControlAtStartup: 'true',
        isolatePeerMachines: 0,
        disableClaudeAiConnectors: null,
        crossSessionInbound: ['accept'],
        forceLoginMethod: { gateway: true },
        remote: { defaultEnvironmentId: 5 },
        spinnerTipsOverride: 'x',
      }),
      filename,
    })),
    // A `ccpool_` text elsewhere in the value is no self-hosted ID. The ID starts with it.
    ...PROJECT_FILES.map((filename) => ({
      code: obj({ remote: { defaultEnvironmentId: 'env_ccpool_1' } }),
      filename,
    })),
    // `forceLoginOrgUUID` has an effect in a project file: a single UUID pre-selects the
    // organization. `bashEditDiffEnabled: true` is for `settings-key-scope`.
    ...PROJECT_FILES.map((filename) => ({
      code: obj({
        forceLoginOrgUUID: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        bashEditDiffEnabled: true,
      }),
      filename,
    })),
    // The same values are valid in a managed file, which the rule does not read.
    ...MANAGED_FILES.map((filename) => ({
      code: obj({
        remoteControlAtStartup: true,
        isolatePeerMachines: false,
        disableClaudeAiConnectors: false,
        crossSessionInbound: 'accept',
        forceLoginMethod: 'gateway',
        remote: { defaultEnvironmentId: 'ccpool_1' },
        spinnerTipsOverride: {
          tips: [{ id: 'a', text: 'b' }],
          tipsFile: '/x',
          label: 'L',
          excludeDefault: true,
        },
      }),
      filename,
    })),
    // Claude Code ignores a hidden drop-in.
    {
      code: obj({ remoteControlAtStartup: true }),
      filename: 'managed-settings.d/.10-x.json',
    },
    // Keys with no listed value in `spinnerTipsOverride`: plain strings, and a non-string entry.
    ...PROJECT_FILES.map((filename) => ({
      code: obj({ spinnerTipsOverride: { tips: ['a', 'b', 1, null, ['c']], other: 1 } }),
      filename,
    })),
    ...PROJECT_FILES.map((filename) => ({
      code: obj({ spinnerTipsOverride: { tips: 'a' } }),
      filename,
    })),
    ...PROJECT_FILES.map((filename) => ({
      code: obj({ spinnerTipsOverride: [{ tipsFile: '/x' }], remote: ['ccpool_1'] }),
      filename,
    })),
    // A key at the wrong level is another key.
    ...PROJECT_FILES.map((filename) => ({
      code: obj({
        sandbox: { remoteControlAtStartup: true },
        defaultEnvironmentId: 'ccpool_1',
        remote: { nested: { defaultEnvironmentId: 'ccpool_1' } },
        tipsFile: '/x',
        label: 'L',
        'remote.defaultEnvironmentId': 'ccpool_1',
        spinnerTipsOverride: { nested: { tipsFile: '/x' } },
      }),
      filename,
    })),
    // A top-level value that is not an object has no keys.
    ...PROJECT_FILES.flatMap((filename) =>
      ['[1]', '"x"', 'null', '1', 'true'].map((code) => ({ code, filename })),
    ),
    // Two keys of one name. The rule reads the last, as `JSON.parse` does.
    {
      code: '{"remoteControlAtStartup": true, "remoteControlAtStartup": false}',
      filename: project,
    },
    {
      code: '{"remote": {"defaultEnvironmentId": "ccpool_1"}, "remote": {}}',
      filename: project,
    },
    {
      code: '{"spinnerTipsOverride": {"tips": [{"id": "a", "text": "b"}], "tips": ["c"]}}',
      filename: project,
    },
  ],
  invalid: [],
})

// The location of `text` in `code`, on line 1.
const span = (code: string, text: string) => ({
  line: 1,
  column: code.indexOf(text) + 1,
  endColumn: code.indexOf(text) + 1 + text.length,
})

jsonTester.run('settings-project-value-ignored (invalid)', rule, {
  valid: [],
  invalid: [
    // Each value reports in each project file, on the value.
    ...PROJECT_FILES.flatMap((filename) => [
      {
        code: '{"remoteControlAtStartup": true}',
        filename,
        errors: [
          {
            messageId: 'remoteControl' as const,
            ...span('{"remoteControlAtStartup": true}', 'true'),
          },
        ],
      },
      {
        code: '{"isolatePeerMachines": false}',
        filename,
        errors: [
          {
            messageId: 'cannotTurnOff' as const,
            data: { key: 'isolatePeerMachines' },
            ...span('{"isolatePeerMachines": false}', 'false'),
          },
        ],
      },
      {
        code: '{"disableClaudeAiConnectors": false}',
        filename,
        errors: [
          {
            messageId: 'cannotTurnOff' as const,
            data: { key: 'disableClaudeAiConnectors' },
            ...span('{"disableClaudeAiConnectors": false}', 'false'),
          },
        ],
      },
      {
        code: '{"crossSessionInbound": "accept"}',
        filename,
        errors: [
          {
            messageId: 'notStricter' as const,
            ...span('{"crossSessionInbound": "accept"}', '"accept"'),
          },
        ],
      },
      {
        code: '{"forceLoginMethod": "gateway"}',
        filename,
        errors: [
          {
            messageId: 'gateway' as const,
            ...span('{"forceLoginMethod": "gateway"}', '"gateway"'),
          },
        ],
      },
      {
        code: '{"remote": {"defaultEnvironmentId": "ccpool_abc"}}',
        filename,
        errors: [
          {
            messageId: 'selfHosted' as const,
            ...span('{"remote": {"defaultEnvironmentId": "ccpool_abc"}}', '"ccpool_abc"'),
          },
        ],
      },
    ]),
    // A `ccpool_` prefix only.
    {
      code: '{"remote": {"defaultEnvironmentId": "ccpool_"}}',
      filename: project,
      errors: [{ messageId: 'selfHosted' as const }],
    },
    // The tips: an object entry, on the entry; and each key, on the key.
    ...PROJECT_FILES.flatMap((filename) => [
      {
        code: '{"spinnerTipsOverride": {"tips": ["a", {"id": "b", "text": "c"}]}}',
        filename,
        errors: [
          {
            messageId: 'tipFeature' as const,
            data: { what: 'a tip object' },
            ...span(
              '{"spinnerTipsOverride": {"tips": ["a", {"id": "b", "text": "c"}]}}',
              '{"id": "b", "text": "c"}',
            ),
          },
        ],
      },
      {
        code: '{"spinnerTipsOverride": {"tipsFile": "~/tips.json"}}',
        filename,
        errors: [
          {
            messageId: 'tipFeature' as const,
            data: { what: '"tipsFile"' },
            ...span('{"spinnerTipsOverride": {"tipsFile": "~/tips.json"}}', '"tipsFile"'),
          },
        ],
      },
      {
        code: '{"spinnerTipsOverride": {"label": "Acme tip"}}',
        filename,
        errors: [
          {
            messageId: 'tipFeature' as const,
            data: { what: '"label"' },
            ...span('{"spinnerTipsOverride": {"label": "Acme tip"}}', '"label"'),
          },
        ],
      },
      {
        code: '{"spinnerTipsOverride": {"excludeDefault": false}}',
        filename,
        errors: [
          {
            messageId: 'tipFeature' as const,
            data: { what: '"excludeDefault"' },
            ...span('{"spinnerTipsOverride": {"excludeDefault": false}}', '"excludeDefault"'),
          },
        ],
      },
    ]),
    // A key reports for any value.
    {
      code: '{"spinnerTipsOverride": {"tipsFile": null, "label": 1, "excludeDefault": "x"}}',
      filename: project,
      errors: [
        { messageId: 'tipFeature' as const },
        { messageId: 'tipFeature' as const },
        { messageId: 'tipFeature' as const },
      ],
    },
    // One report for each tip object, and for each key.
    {
      code: obj({
        spinnerTipsOverride: {
          tips: [{ id: 'a', text: 'b' }, 'plain', { id: 'c', text: 'd' }],
          label: 'L',
        },
      }),
      filename: local,
      errors: [
        { messageId: 'tipFeature' as const, data: { what: 'a tip object' } },
        { messageId: 'tipFeature' as const, data: { what: 'a tip object' } },
        { messageId: 'tipFeature' as const, data: { what: '"label"' } },
      ],
    },
    // One report for each value, in file order.
    {
      code: obj({
        remoteControlAtStartup: true,
        isolatePeerMachines: false,
        crossSessionInbound: 'accept',
        forceLoginMethod: 'gateway',
      }),
      filename: project,
      errors: [
        { messageId: 'remoteControl' as const },
        { messageId: 'cannotTurnOff' as const },
        { messageId: 'notStricter' as const },
        { messageId: 'gateway' as const },
      ],
    },
    // The text of each message.
    {
      code: '{"remoteControlAtStartup": true, "model": "m"}',
      filename: project,
      errors: [
        {
          message:
            'Claude Code ignores "remoteControlAtStartup": true in a project or local settings file. A repository can turn auto-connect off, and cannot turn it on.',
        },
      ],
    },
    {
      code: '{"isolatePeerMachines": false, "model": "m"}',
      filename: project,
      errors: [
        {
          message:
            'A project or local settings file cannot turn off "isolatePeerMachines". Claude Code applies a true from any file, so "false" here has no effect.',
        },
      ],
    },
    {
      code: '{"crossSessionInbound": "accept", "model": "m"}',
      filename: project,
      errors: [
        {
          message:
            'Claude Code ignores "crossSessionInbound": "accept" in a project or local settings file. It applies a project value only when it is stricter than the value from managed, user or --settings sources: "hold" or "refuse".',
        },
      ],
    },
    {
      code: '{"forceLoginMethod": "gateway", "model": "m"}',
      filename: project,
      errors: [
        {
          message:
            'Claude Code treats "forceLoginMethod": "gateway" as unset in a project or local settings file. Only a managed source on the machine can set it.',
        },
      ],
    },
    {
      code: '{"remote": {"defaultEnvironmentId": "ccpool_1", "x": 1}}',
      filename: project,
      errors: [
        {
          message:
            'Claude Code ignores a self-hosted environment ID in "remote.defaultEnvironmentId" in a project or local settings file. It reads one from user settings, managed settings and --settings only.',
        },
      ],
    },
    {
      code: '{"spinnerTipsOverride": {"tipsFile": "/x", "tips": []}}',
      filename: project,
      errors: [
        {
          message:
            'Claude Code reads plain string tips only from a project or local settings file. It ignores "tipsFile" there.',
        },
      ],
    },
    // Two keys of one name. The rule reads the last.
    {
      code: '{"remoteControlAtStartup": false, "remoteControlAtStartup": true}',
      filename: project,
      errors: [{ messageId: 'remoteControl' as const, column: 61 }],
    },
    {
      code: '{"remote": {}, "remote": {"defaultEnvironmentId": "ccpool_1"}}',
      filename: project,
      errors: [{ messageId: 'selfHosted' as const }],
    },
    {
      code: '{"spinnerTipsOverride": {"tips": ["a"]}, "spinnerTipsOverride": {"label": "L"}}',
      filename: project,
      errors: [{ messageId: 'tipFeature' as const, data: { what: '"label"' } }],
    },
    {
      code: '{"spinnerTipsOverride": {"tips": [{"id": "a", "text": "b"}], "tips": ["c"], "label": "L"}}',
      filename: project,
      errors: [{ messageId: 'tipFeature' as const, data: { what: '"label"' } }],
    },
  ],
})

// `bashEditDiffEnabled: true` is in the row of this rule, and `settings-key-scope` reports it.
// A key that two rules report would give one fault two reports.
describe('settings-project-value-ignored and settings-key-scope on one value', () => {
  const lint = (code: string) =>
    new Linter().verify(
      code,
      [
        {
          files: ['**/*.json'],
          plugins: { json, claude: plugin },
          language: 'json/json',
          rules: {
            'claude/settings-project-value-ignored': 'error',
            'claude/settings-key-scope': 'error',
          },
        },
      ],
      { filename: project },
    )

  it('gives bashEditDiffEnabled true one report, from settings-key-scope', () => {
    expect(lint(obj({ bashEditDiffEnabled: true })).map(({ ruleId }) => ruleId)).toEqual([
      'claude/settings-key-scope',
    ])
  })

  it('gives each value of this rule one report, from this rule', () => {
    const messages = lint(obj({ remoteControlAtStartup: true, crossSessionInbound: 'accept' }))
    expect(messages.map(({ ruleId }) => ruleId)).toEqual([
      'claude/settings-project-value-ignored',
      'claude/settings-project-value-ignored',
    ])
  })
})
