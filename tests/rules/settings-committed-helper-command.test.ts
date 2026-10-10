// The expected values come from the settings reference
// (https://code.claude.com/docs/en/settings-reference#apikeyhelper): a helper key holds a shell
// command, and a command from project or local settings waits for the trust prompt in an
// interactive session. The permissions page
// (https://code.claude.com/docs/en/permissions#what-runs-before-you-trust-a-folder) says that a
// helper command runs in `claude -p` with no trust prompt. The rule reads the shared file only.
// The file globs are in `tests/configs.test.ts`.
import { describe, expect, it } from 'vitest'
import { COMMAND_OBJECT_KEYS, COMMAND_STRING_KEYS } from '../../src/data/settings-keys.ts'
import { jsonTester, lintJson, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-committed-helper-command')

const project = '.claude/settings.json'
const object = (key: string, command: unknown) =>
  JSON.stringify({ [key]: { type: 'command', command } })

jsonTester.run('settings-committed-helper-command (valid)', rule, {
  valid: [
    // An empty command runs nothing.
    ...COMMAND_STRING_KEYS.map((key) => ({
      code: JSON.stringify({ [key]: '' }),
      filename: project,
    })),
    ...COMMAND_OBJECT_KEYS.map((key) => ({ code: object(key, ''), filename: project })),
    // A value of another shape is for `settings-schema`.
    ...[...COMMAND_STRING_KEYS, ...COMMAND_OBJECT_KEYS].flatMap((key) =>
      [null, 1, true, [], ['x']].map((value) => ({
        code: JSON.stringify({ [key]: value }),
        filename: project,
      })),
    ),
    ...COMMAND_OBJECT_KEYS.flatMap((key) =>
      [null, 1, ['x'], {}].map((command) => ({ code: object(key, command), filename: project })),
    ),
    // A string where the key takes an object, and an object where it takes a string.
    ...COMMAND_OBJECT_KEYS.map((key) => ({
      code: JSON.stringify({ [key]: '~/status.sh' }),
      filename: project,
    })),
    ...COMMAND_STRING_KEYS.map((key) => ({ code: object(key, 'x.sh'), filename: project })),
    // Keys that are not command keys, and a nested key of the same name.
    { code: JSON.stringify({ model: 'opus', env: { apiKeyHelper: 'x.sh' } }), filename: project },
    {
      code: JSON.stringify({ apiKeyHelperX: 'x.sh', hooks: { statusLine: 'x' } }),
      filename: project,
    },
    // The top-level value is no object.
    { code: '[]', filename: project },
    // Two keys of one name: the last counts, as in `JSON.parse`.
    { code: '{"apiKeyHelper": "x.sh", "apiKeyHelper": ""}', filename: project },
  ],
  invalid: [
    ...COMMAND_STRING_KEYS.map((key) => ({
      code: JSON.stringify({ [key]: '/bin/helper.sh' }),
      filename: project,
      errors: [{ messageId: 'helper' as const }],
    })),
    ...COMMAND_OBJECT_KEYS.map((key) => ({
      code: object(key, '~/.claude/status.sh'),
      filename: project,
      errors: [{ messageId: 'helper' as const }],
    })),
    // The report is on the key. Each key gets its own report.
    {
      code: '{\n  "apiKeyHelper": "a.sh",\n  "awsAuthRefresh": "b.sh"\n}',
      filename: project,
      errors: [
        { messageId: 'helper' as const, line: 2, column: 3 },
        { messageId: 'helper' as const, line: 3, column: 3 },
      ],
    },
    // Two keys of one name give one report, for the last.
    {
      code: '{\n  "apiKeyHelper": "",\n  "apiKeyHelper": "a.sh"\n}',
      filename: project,
      errors: [{ messageId: 'helper' as const, line: 3, column: 3 }],
    },
  ],
})

describe('settings-committed-helper-command: the keys', () => {
  it('lists the eight keys of the row', () => {
    expect([...COMMAND_STRING_KEYS, ...COMMAND_OBJECT_KEYS].sort()).toEqual(
      [
        'apiKeyHelper',
        'awsAuthRefresh',
        'awsCredentialExport',
        'fileSuggestion',
        'gcpAuthRefresh',
        'otelHeadersHelper',
        'statusLine',
        'subagentStatusLine',
      ].sort(),
    )
  })

  it('names the key and the trust prompt', () => {
    const [message] = lintJson(
      'settings-committed-helper-command',
      JSON.stringify({ gcpAuthRefresh: 'gcloud auth login' }),
      `/repo/${project}`,
    )
    expect(message?.message).toContain('"gcpAuthRefresh"')
    expect(message?.message).toContain('trust prompt')
  })
})
