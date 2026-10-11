// The expected values come from the env vars reference
// (https://code.claude.com/docs/en/env-vars#variables) and the model configuration page
// (https://code.claude.com/docs/en/model-config#environment-variables). The reference marks
// `ANTHROPIC_SMALL_FAST_MODEL` and `ENABLE_PROMPT_CACHING_1H_BEDROCK` as deprecated. It calls
// `DISABLE_BUG_COMMAND` an older name, and `SLASH_COMMAND_TOOL_CHAR_BUDGET` a legacy name. It says
// that `CLAUDE_CODE_ENABLE_TASKS` set to `0` gives the legacy `TodoWrite` tool.
import { describe, expect, it } from 'vitest'
import {
  deprecatedEnvSummary,
  envIgnoredIn,
  removedEnvVarSince,
} from '../../src/data/settings-env.ts'
import { jsonTester, lintJson, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-env-deprecated-var')

const project = '.claude/settings.json'
const local = '.claude/settings.local.json'
const managed = 'managed-settings.json'
const dropIn = 'managed-settings.d/10-x.json'
const ALL = [project, local, managed, dropIn]
const env = (value: object) => JSON.stringify({ env: value })

/** The names that the rule reports for any non-empty value, and the replacement in the message. */
const NAMES = [
  'ANTHROPIC_SMALL_FAST_MODEL',
  'ENABLE_PROMPT_CACHING_1H_BEDROCK',
  'DISABLE_BUG_COMMAND',
  'SLASH_COMMAND_TOOL_CHAR_BUDGET',
]

jsonTester.run('settings-env-deprecated-var (valid)', rule, {
  valid: [
    // A variable that is not deprecated, and the region variable that only mentions one.
    ...ALL.map((filename) => ({
      code: env({
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'haiku',
        ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION: 'us-east-1',
        DISABLE_FEEDBACK_COMMAND: '1',
        ENABLE_PROMPT_CACHING_1H: '1',
      }),
      filename,
    })),
    // `CLAUDE_CODE_ENABLE_TASKS` is a fault for the value `0` only.
    ...['1', 'true', ''].map((value) => ({
      code: env({ CLAUDE_CODE_ENABLE_TASKS: value }),
      filename: project,
    })),
    // `""` cancels a shell value. A value that is not a string is for `settings-env-value-format`.
    ...NAMES.flatMap((key) =>
      ['', null, 1, true, ['x'], { a: 'b' }].map((value) => ({
        code: env({ [key]: value }),
        filename: project,
      })),
    ),
    { code: env({ CLAUDE_CODE_ENABLE_TASKS: 0 }), filename: project },
    // The file holds no `env` block, or a block that is no object.
    { code: '{}', filename: project },
    { code: '[]', filename: project },
    { code: JSON.stringify({ env: ['ANTHROPIC_SMALL_FAST_MODEL'] }), filename: project },
    { code: JSON.stringify({ env: null }), filename: project },
    // A hidden drop-in: Claude Code ignores it.
    {
      code: env({ ANTHROPIC_SMALL_FAST_MODEL: 'haiku' }),
      filename: 'managed-settings.d/.10-x.json',
    },
    // Two keys of one name: the last counts, as in `JSON.parse`.
    {
      code: '{"env": {"DISABLE_BUG_COMMAND": "1", "DISABLE_BUG_COMMAND": ""}}',
      filename: project,
    },
  ],
  invalid: [
    ...ALL.flatMap((filename) =>
      NAMES.map((key) => ({
        code: env({ [key]: '1' }),
        filename,
        errors: [{ messageId: 'deprecated' as const }],
      })),
    ),
    ...ALL.map((filename) => ({
      code: env({ CLAUDE_CODE_ENABLE_TASKS: '0' }),
      filename,
      errors: [{ messageId: 'deprecated' as const }],
    })),
    // The report is on the variable name. Two keys of one name give one report, for the last.
    {
      code: '{\n  "env": {\n    "DISABLE_BUG_COMMAND": "0",\n    "DISABLE_BUG_COMMAND": "1"\n  }\n}',
      filename: project,
      errors: [{ messageId: 'deprecated' as const, line: 4, column: 5 }],
    },
    // Each variable gets its own report.
    {
      code: env({ DISABLE_BUG_COMMAND: '1', ANTHROPIC_SMALL_FAST_MODEL: 'haiku' }),
      filename: project,
      errors: [{ messageId: 'deprecated' as const }, { messageId: 'deprecated' as const }],
    },
  ],
})

describe('settings-env-deprecated-var: messages', () => {
  const text = (key: string, value = '1', filename = project) =>
    lintJson('settings-env-deprecated-var', env({ [key]: value }), `/repo/${filename}`)[0]?.message

  it('names the replacement that the docs give', () => {
    expect(text('ANTHROPIC_SMALL_FAST_MODEL')).toContain('ANTHROPIC_DEFAULT_HAIKU_MODEL')
    expect(text('ENABLE_PROMPT_CACHING_1H_BEDROCK')).toContain('"ENABLE_PROMPT_CACHING_1H"')
    expect(text('DISABLE_BUG_COMMAND')).toContain('DISABLE_FEEDBACK_COMMAND')
  })

  it('names no replacement for the legacy name, because the docs give none', () => {
    expect(text('SLASH_COMMAND_TOOL_CHAR_BUDGET')).toBe(
      '"SLASH_COMMAND_TOOL_CHAR_BUDGET" is a legacy name that Claude Code keeps for backward compatibility.',
    )
  })

  it('names the legacy tool for the task variable', () => {
    expect(text('CLAUDE_CODE_ENABLE_TASKS', '0')).toContain('TodoWrite')
  })
})

describe('settings-env-deprecated-var: one report for one fault', () => {
  it('lists no variable that settings-env-ignored-var reports', () => {
    for (const key of [...NAMES, 'CLAUDE_CODE_ENABLE_TASKS']) {
      expect(removedEnvVarSince(key), key).toBeUndefined()
      expect(envIgnoredIn(key), key).toBeUndefined()
      expect(deprecatedEnvSummary(key, '0'), key).toBeDefined()
    }
  })
})
