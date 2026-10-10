// The expected values come from the prompt caching page
// (https://code.claude.com/docs/en/prompt-caching#disable-prompt-caching): five variables turn
// caching off when set to `1`, and the page names managed settings for an organization policy.
// The env vars reference (https://code.claude.com/docs/en/env-vars#variables) says that a Boolean
// variable is on for `1`, `true`, `yes` and `on` in any casing. The rule reads the shared file
// only. The file globs are in `tests/configs.test.ts`.
import { describe, expect, it } from 'vitest'
import { jsonTester, lintJson, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-env-prompt-caching-off')

const project = '.claude/settings.json'
const env = (value: object) => JSON.stringify({ env: value })

const VARIABLES = [
  'DISABLE_PROMPT_CACHING',
  'DISABLE_PROMPT_CACHING_FABLE',
  'DISABLE_PROMPT_CACHING_HAIKU',
  'DISABLE_PROMPT_CACHING_OPUS',
  'DISABLE_PROMPT_CACHING_SONNET',
]

jsonTester.run('settings-env-prompt-caching-off (valid)', rule, {
  valid: [
    // An off value, an empty value (which cancels a shell value), and a value of another type.
    ...VARIABLES.flatMap((key) =>
      ['0', 'false', 'no', 'off', '', '2', 'x'].map((value) => ({
        code: env({ [key]: value }),
        filename: project,
      })),
    ),
    ...VARIABLES.flatMap((key) =>
      [null, 1, true, ['1']].map((value) => ({ code: env({ [key]: value }), filename: project })),
    ),
    // A variable that is not on the list, and the TTL variables.
    {
      code: env({ DISABLE_PROMPT_CACHING_OTHER: '1', CLAUDE_CODE_PROMPT_CACHE_TTL: '1h' }),
      filename: project,
    },
    { code: env({ FORCE_PROMPT_CACHING_5M: '1' }), filename: project },
    // No `env` block, or a block that is no object.
    { code: '{}', filename: project },
    { code: JSON.stringify({ env: 'DISABLE_PROMPT_CACHING' }), filename: project },
    // Two keys of one name: the last counts, as in `JSON.parse`.
    {
      code: '{"env": {"DISABLE_PROMPT_CACHING": "1", "DISABLE_PROMPT_CACHING": "0"}}',
      filename: project,
    },
  ],
  invalid: [
    ...VARIABLES.flatMap((key) =>
      ['1', 'true', 'Yes', 'ON'].map((value) => ({
        code: env({ [key]: value }),
        filename: project,
        errors: [{ messageId: 'off' as const }],
      })),
    ),
    // The report is on the variable name. Each variable gets its own report.
    {
      code: '{\n  "env": {\n    "DISABLE_PROMPT_CACHING": "1",\n    "DISABLE_PROMPT_CACHING_OPUS": "1"\n  }\n}',
      filename: project,
      errors: [
        { messageId: 'off' as const, line: 3, column: 5 },
        { messageId: 'off' as const, line: 4, column: 5 },
      ],
    },
  ],
})

describe('settings-env-prompt-caching-off: message', () => {
  it('names the variable and the cost', () => {
    const [message] = lintJson(
      'settings-env-prompt-caching-off',
      env({ DISABLE_PROMPT_CACHING_HAIKU: '1' }),
      `/repo/${project}`,
    )
    expect(message?.message).toContain('"DISABLE_PROMPT_CACHING_HAIKU"')
    expect(message?.message).toContain('costs more')
  })
})
