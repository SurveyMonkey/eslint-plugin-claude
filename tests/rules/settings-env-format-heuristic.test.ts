// The expected values come from the rows of the env vars reference
// (https://code.claude.com/docs/en/env-vars#variables). `MAX_MCP_OUTPUT_TOKENS` is a number of
// tokens. `MCP_TIMEOUT` and `MCP_TOOL_TIMEOUT` are in milliseconds. For
// `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` and `CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS`, "Set to `0`" turns
// the feature off. `CLAUDE_CODE_USE_POWERSHELL_TOOL` is `0` or `1`. The empty string cancels a
// shell value. The file globs are in `tests/configs.test.ts`.
import { describe, expect, it } from 'vitest'
import { jsonTester, lintJson, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-env-format-heuristic')

const project = '.claude/settings.json'
const local = '.claude/settings.local.json'
const managed = 'managed-settings.json'
const dropIn = 'managed-settings.d/10-mcp.json'
const hidden = 'managed-settings.d/.10-mcp.json'
const env = (value: object) => JSON.stringify({ env: value })

const WHOLE = [
  'MCP_TIMEOUT',
  'MCP_TOOL_TIMEOUT',
  'CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT',
  'CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS',
]

jsonTester.run('settings-env-format-heuristic (valid)', rule, {
  valid: [
    // A good value of each variable, in each kind of file.
    ...[project, local, managed, dropIn].flatMap((filename) => [
      { code: env({ MAX_MCP_OUTPUT_TOKENS: '50000' }), filename },
      { code: env({ CLAUDE_CODE_USE_POWERSHELL_TOOL: '1' }), filename },
      { code: env({ CLAUDE_CODE_USE_POWERSHELL_TOOL: '0' }), filename },
      ...WHOLE.map((key) => ({ code: env({ [key]: '30000' }), filename })),
    ]),
    // `0` turns the idle check and the backgrounding off, and the floor of a timeout is 1000.
    { code: env({ CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT: '0' }), filename: project },
    { code: env({ CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS: '0' }), filename: project },
    { code: env({ MCP_TOOL_TIMEOUT: '500' }), filename: project },
    // The empty string cancels a shell value.
    ...['MAX_MCP_OUTPUT_TOKENS', 'CLAUDE_CODE_USE_POWERSHELL_TOOL', ...WHOLE].map((key) => ({
      code: env({ [key]: '' }),
      filename: project,
    })),
    // A value that is no string is for settings-env-value-format.
    ...[7, null, true, ['1'], {}].map((value) => ({
      code: env({ MAX_MCP_OUTPUT_TOKENS: value, MCP_TIMEOUT: value }),
      filename: project,
    })),
    // Another variable, and a variable with a form of settings-env-value-format.
    { code: env({ MCP_SERVER_TIMEOUT: 'x', BASH_MAX_OUTPUT_LENGTH: 'x' }), filename: project },
    // No env block, or a block that is no object.
    { code: '{}', filename: project },
    { code: JSON.stringify({ env: 'MCP_TIMEOUT' }), filename: project },
    { code: '[1]', filename: project },
    // Two keys of one name: the last counts, as in `JSON.parse`.
    { code: '{"env": {"MCP_TIMEOUT": "x", "MCP_TIMEOUT": "5000"}}', filename: project },
    // A hidden drop-in is ignored by Claude Code.
    { code: env({ MCP_TIMEOUT: 'x' }), filename: hidden },
  ],
  invalid: [
    {
      code: '{\n  "env": {\n    "MAX_MCP_OUTPUT_TOKENS": "0"\n  }\n}',
      filename: project,
      errors: [{ messageId: 'badForm', line: 3, column: 30 }],
    },
    ...['0', '-5', '1.5', '25k', '1e5', '25_000', ' 5', 'many'].map((value) => ({
      code: env({ MAX_MCP_OUTPUT_TOKENS: value }),
      filename: project,
      errors: [{ messageId: 'badForm' as const }],
    })),
    ...WHOLE.flatMap((key) =>
      ['-1', '1.5', '30s', '1e3', '30_000', ' 30000', 'x'].map((value) => ({
        code: env({ [key]: value }),
        filename: project,
        errors: [{ messageId: 'badForm' as const }],
      })),
    ),
    ...['true', 'false', '2', 'yes', 'on', '01', ' 1'].map((value) => ({
      code: env({ CLAUDE_CODE_USE_POWERSHELL_TOOL: value }),
      filename: project,
      errors: [{ messageId: 'badForm' as const }],
    })),
    // The local file and the managed files too.
    { code: env({ MCP_TIMEOUT: '30s' }), filename: local, errors: [{ messageId: 'badForm' }] },
    { code: env({ MCP_TIMEOUT: '30s' }), filename: managed, errors: [{ messageId: 'badForm' }] },
    { code: env({ MCP_TIMEOUT: '30s' }), filename: dropIn, errors: [{ messageId: 'badForm' }] },
    // Each variable gets its own report, and the last of two keys of one name counts.
    {
      code: '{"env": {"MCP_TIMEOUT": "5000", "MCP_TIMEOUT": "5s", "MAX_MCP_OUTPUT_TOKENS": "0"}}',
      filename: project,
      errors: [{ messageId: 'badForm' }, { messageId: 'badForm' }],
    },
  ],
})

describe('settings-env-format-heuristic: messages', () => {
  const messages = (code: string) =>
    lintJson('settings-env-format-heuristic', code, `/repo/${project}`).map((m) => m.message)

  it('names the variable and the form', () => {
    expect(messages(env({ MAX_MCP_OUTPUT_TOKENS: '0' }))).toEqual([
      'The value of "MAX_MCP_OUTPUT_TOKENS" should be a positive whole number in plain digits.',
    ])
    expect(messages(env({ MCP_TIMEOUT: '30s' }))).toEqual([
      'The value of "MCP_TIMEOUT" should be a whole number of milliseconds in plain digits.',
    ])
    expect(messages(env({ CLAUDE_CODE_USE_POWERSHELL_TOOL: 'true' }))).toEqual([
      'The value of "CLAUDE_CODE_USE_POWERSHELL_TOOL" should be 0 or 1.',
    ])
  })
})
