// The expected values come from two pages. The prompt caching page says that
// `FORCE_PROMPT_CACHING_5M=1` forces the five-minute TTL, and is for debugging
// (https://code.claude.com/docs/en/prompt-caching#choose-the-ttl-yourself). The env vars reference
// says that `ENABLE_TOOL_SEARCH` set to `false` loads all tools upfront
// (https://code.claude.com/docs/en/env-vars#variables), and the prompt caching page says that
// tools loaded upfront invalidate the cache when the set of tools changes. The rule reads the
// shared file only. The file glob is in `tests/configs.test.ts`.
import { describe, expect, it } from 'vitest'
import { jsonTester, lintJson, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-env-context-cost')

const project = '.claude/settings.json'
const env = (value: object) => JSON.stringify({ env: value })

jsonTester.run('settings-env-context-cost (valid)', rule, {
  valid: [
    // The force variable off, empty, or of another type.
    ...['0', 'false', 'no', 'off', '', '2', 'x'].map((value) => ({
      code: env({ FORCE_PROMPT_CACHING_5M: value }),
      filename: project,
    })),
    ...[null, 1, true, ['1']].map((value) => ({
      code: env({ FORCE_PROMPT_CACHING_5M: value }),
      filename: project,
    })),
    // Tool search on, automatic, or empty.
    ...['true', '1', 'auto', 'auto:5', ''].map((value) => ({
      code: env({ ENABLE_TOOL_SEARCH: value }),
      filename: project,
    })),
    ...[null, false, 0].map((value) => ({
      code: env({ ENABLE_TOOL_SEARCH: value }),
      filename: project,
    })),
    // The TTL variables and the caching switches belong to other rules.
    {
      code: env({
        CLAUDE_CODE_PROMPT_CACHE_TTL: '5m',
        ENABLE_PROMPT_CACHING_1H: '1',
        DISABLE_PROMPT_CACHING: '1',
      }),
      filename: project,
    },
    // No env block, or a block that is no object.
    { code: '{}', filename: project },
    { code: JSON.stringify({ env: 'FORCE_PROMPT_CACHING_5M' }), filename: project },
    { code: '[1]', filename: project },
    // Two keys of one name: the last counts, as in `JSON.parse`.
    {
      code: '{"env": {"FORCE_PROMPT_CACHING_5M": "1", "FORCE_PROMPT_CACHING_5M": "0"}}',
      filename: project,
    },
  ],
  invalid: [
    ...['1', 'true', 'Yes', 'ON'].map((value) => ({
      code: env({ FORCE_PROMPT_CACHING_5M: value }),
      filename: project,
      errors: [{ messageId: 'fiveMinutes' as const }],
    })),
    ...['false', 'FALSE', '0', 'no', 'off'].map((value) => ({
      code: env({ ENABLE_TOOL_SEARCH: value }),
      filename: project,
      errors: [{ messageId: 'toolSearchOff' as const }],
    })),
    // The report is on the variable name. Each variable gets its own report.
    {
      code: '{\n  "env": {\n    "FORCE_PROMPT_CACHING_5M": "1",\n    "ENABLE_TOOL_SEARCH": "false"\n  }\n}',
      filename: project,
      errors: [
        { messageId: 'fiveMinutes', line: 3, column: 5 },
        { messageId: 'toolSearchOff', line: 4, column: 5 },
      ],
    },
  ],
})

describe('settings-env-context-cost: messages', () => {
  const messages = (code: string) =>
    lintJson('settings-env-context-cost', code, `/repo/${project}`).map((m) => m.message)

  it('names the variable and the cost of the cache', () => {
    const [message] = messages(env({ FORCE_PROMPT_CACHING_5M: '1' }))
    expect(message).toContain('"FORCE_PROMPT_CACHING_5M"')
    expect(message).toContain('5-minute')
  })

  it('names the variable and the cost of the tools', () => {
    const [message] = messages(env({ ENABLE_TOOL_SEARCH: 'false' }))
    expect(message).toContain('"ENABLE_TOOL_SEARCH"')
    expect(message).toContain('every MCP tool')
  })
})
