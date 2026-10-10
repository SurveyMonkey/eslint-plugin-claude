// The expected values come from the env vars reference
// (https://code.claude.com/docs/en/env-vars#variables), the `env` entry of the settings
// reference (https://code.claude.com/docs/en/settings-reference#env), the tool search table of
// the MCP page, the memory limit section of the tools reference, and the capabilities table of
// the model configuration page.
import { describe, expect, it } from 'vitest'
import { jsonTester, lintJson, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-env-value-format')

const project = '.claude/settings.json'
const local = '.claude/settings.local.json'
const managed = 'managed-settings.json'
const dropIn = 'managed-settings.d/10-x.json'
const ALL = [project, local, managed, dropIn]
const env = (value: object) => JSON.stringify({ env: value })

// A variable, the values that its form accepts, and the values that it does not.
const FORMS: { name: string; pass: string[]; fail: string[]; expected: string }[] = [
  {
    // "Accepts a positive whole number in plain digits; anything else is ignored".
    name: 'CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH',
    pass: ['1', '3', '10'],
    fail: ['0', '-1', '1.5', '3 ', '1e1', 'three', '5x'],
    expected: 'a positive whole number in plain digits',
  },
  {
    // The same text.
    name: 'CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS',
    pass: ['1', '20'],
    fail: ['0', '2.5', 'many', '+3'],
    expected: 'a positive whole number in plain digits',
  },
  {
    // "Takes plain digits only; 0, a decimal, or any other spelling keeps the default".
    name: 'CLAUDE_CODE_WEBFETCH_CACHE_TTL_MS',
    pass: ['900000', '1'],
    fail: ['0', '1.5', '15m', '9e5'],
    expected: 'a positive whole number in plain digits',
  },
  {
    // "from 100000 to 1000000. Accepts a plain integer such as 500000 only".
    name: 'CLAUDE_CODE_AUTO_COMPACT_WINDOW',
    pass: ['100000', '500000', '1000000'],
    fail: ['500k', '1M', '99999', '1000001', '5e5', '500000.0'],
    expected: 'a plain integer from 100000 to 1000000',
  },
  {
    // "default: 30000; maximum: 150000".
    name: 'BASH_MAX_OUTPUT_LENGTH',
    pass: ['30000', '150000', '1'],
    fail: ['150001', '200000'],
    expected: 'at most 150000',
  },
  {
    // "Write the size as a number of bytes or with a K, M, G, or T suffix. Set 0, off, false, no,
    // or none to turn the cap off. Claude Code ignores any other value it can't read as a size,
    // such as 4e9". Lower-case spellings are a choice of the plugin.
    name: 'CLAUDE_CODE_TOOL_MEMORY_LIMIT',
    pass: ['4G', '512M', '1024', '2T', '64K', '0', 'off', 'false', 'no', 'none', '4g', 'OFF', 'No'],
    fail: ['4e9', '4 GB', 'G', '1.5G', 'unlimited', '4GB', '4P', '4B', '4KM', '4GG'],
    expected:
      'a size in plain digits with an optional K, M, G or T suffix, or one of 0, off, false, no, none',
  },
  {
    // "none", "all-new", or a comma-separated list of kinds. "Unknown names: Claude Code ignores
    // names it doesn't recognize", so a name that is not in the table is valid.
    name: 'CLAUDE_CODE_TOOL_MEMORY_CGROUP_EXCLUDE',
    pass: [
      'none',
      'all-new',
      'mcp',
      'mcp,lsp',
      'hooks, plugin',
      'helper,agent',
      'mcps',
      'mcp,newkind',
      'MCP',
      'my_kind-2',
      'a',
    ],
    fail: ['mcp,', ',mcp', 'mcp;lsp', 'mcp,,lsp', 'two words', '1mcp', '-x', '_x'],
    expected: 'none, all-new, or a comma-separated list of kind names such as mcp, lsp or hooks',
  },
  {
    // "true, false, auto, auto:N where N is 0-100". The env vars reference says that a variable
    // that turns a behavior on or off takes "1, true, yes, or on" and "0, false, no, or off",
    // "in any casing".
    name: 'ENABLE_TOOL_SEARCH',
    pass: [
      'true',
      'false',
      'auto',
      'auto:0',
      'auto:5',
      'auto:100',
      '1',
      '0',
      'yes',
      'On',
      'TRUE',
      'AUTO',
      'Auto:50',
      'no',
      'off',
    ],
    fail: ['auto:101', 'auto:-1', 'auto:5.5', 'auto:', 'auto:x', 'maybe', 'enabled'],
    expected: 'a Boolean word such as true or false, auto, or auto:N with N from 0 to 100',
  },
  {
    // "v1 ... or v2".
    name: 'MCP_SDK_GENERATION',
    pass: ['v1', 'v2'],
    fail: ['1', 'v3', 'V2', 'latest'],
    expected: 'v1 or v2',
  },
  {
    // "Set auto ... or legacy".
    name: 'MCP_PROTOCOL_NEGOTIATION',
    pass: ['auto', 'legacy'],
    fail: ['on', 'off', 'Auto'],
    expected: 'auto or legacy',
  },
  {
    // "Set 5m or 1h, the only values Claude Code accepts".
    name: 'CLAUDE_CODE_PROMPT_CACHE_TTL',
    pass: ['5m', '1h'],
    fail: ['5', '1H', '60m', '1', 'true'],
    expected: '5m or 1h',
  },
  {
    name: 'CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL',
    pass: ['5m', '1h'],
    fail: ['5', '1H', '60m'],
    expected: '5m or 1h',
  },
  {
    // "low, medium, high, xhigh, max, or auto". The persisted setting and the variable do not
    // accept `ultracode`.
    name: 'CLAUDE_CODE_EFFORT_LEVEL',
    pass: ['low', 'medium', 'high', 'xhigh', 'max', 'auto'],
    fail: ['ultracode', 'Low', 'extreme', 'off'],
    expected: 'low, medium, high, xhigh, max or auto',
  },
  {
    // "Accepts a path to a bash or zsh binary. Other shells such as fish are not supported".
    name: 'CLAUDE_CODE_SHELL',
    pass: ['/opt/homebrew/bin/bash', '/bin/zsh', 'bash', 'C:\\Program Files\\Git\\bin\\bash.exe'],
    fail: ['/usr/bin/fish', 'fish', '/bin/sh', '/opt/bash/bin/', 'bashrc', 'mybash', '/bin/notzsh'],
    expected: 'a path to a bash or zsh binary',
  },
  {
    // "effort, xhigh_effort, max_effort, thinking, adaptive_thinking, interleaved_thinking".
    name: 'ANTHROPIC_DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES',
    pass: [
      'effort',
      'effort,thinking',
      'effort, xhigh_effort,max_effort,adaptive_thinking,interleaved_thinking',
    ],
    fail: ['reasoning', 'effort,', 'effort,,thinking', 'effort thinking', 'Effort', 'xhigh'],
    expected:
      'a comma-separated list of effort, xhigh_effort, max_effort, thinking, adaptive_thinking, interleaved_thinking',
  },
]

// Every family member takes the capabilities form.
const CAPABILITY_VARIABLES = [
  'ANTHROPIC_DEFAULT_SONNET_MODEL_SUPPORTED_CAPABILITIES',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL_SUPPORTED_CAPABILITIES',
  'ANTHROPIC_DEFAULT_FABLE_MODEL_SUPPORTED_CAPABILITIES',
  'ANTHROPIC_DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES',
  'ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES',
]

jsonTester.run('settings-env-value-format (valid)', rule, {
  valid: [
    // A string value that is no known variable has no form.
    ...ALL.map((filename) => ({
      code: env({ FOO: 'anything at all', API_TIMEOUT_MS: '1200000', DISABLE_AUTO_COMPACT: '1' }),
      filename,
    })),
    // `""` is a valid value for each variable. It cancels a shell value.
    ...FORMS.map(({ name }) => ({ code: env({ [name]: '' }), filename: project })),
    ...CAPABILITY_VARIABLES.filter((name) => !FORMS.some((form) => form.name === name)).map(
      (name) => ({ code: env({ [name]: '' }), filename: project }),
    ),
    // The values that each form accepts, in a project file and a managed file.
    ...FORMS.flatMap(({ name, pass }) =>
      pass.flatMap((value) =>
        [project, managed].map((filename) => ({ code: env({ [name]: value }), filename })),
      ),
    ),
    ...CAPABILITY_VARIABLES.map((name) => ({
      code: env({ [name]: 'effort,thinking' }),
      filename: local,
    })),
    // The suffix of a variable with a form is part of the name. A near name has no form.
    ...ALL.map((filename) => ({
      code: env({
        ANTHROPIC_DEFAULT_OPUS_MODEL_NAME: 'my opus',
        ANTHROPIC_DEFAULT_MODEL_SUPPORTED_CAPABILITIES_X: 'a',
        MY_ANTHROPIC_DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES: 'a',
        CLAUDE_CODE_SHELL_X: 'fish',
      }),
      filename,
    })),
    // The variable name has letter case.
    { code: env({ enable_tool_search: 'yes' }), filename: project },
    // Variables outside `env` have no form.
    ...ALL.map((filename) => ({
      code: JSON.stringify({
        ENABLE_TOOL_SEARCH: 1,
        sandbox: { env: { A: 1 } },
        hooks: { env: 1 },
      }),
      filename,
    })),
    // A top-level value that is not an object has no `env`. So does an object without it.
    ...ALL.flatMap((filename) =>
      ['[1]', '"x"', 'null', '1', 'true', '{}'].map((code) => ({ code, filename })),
    ),
    // Claude Code ignores a hidden drop-in.
    { code: env({ FOO: 1 }), filename: 'managed-settings.d/.10-x.json' },
    { code: '{"env": 1}', filename: 'etc/managed-settings.d/.10-x.json' },
    // Two keys of one name. The rule reads the last, as `JSON.parse` does.
    { code: '{"env": {"FOO": 1, "FOO": "1"}}', filename: project },
    { code: '{"env": 1, "env": {"FOO": "1"}}', filename: project },
    {
      code: '{"env": {"ENABLE_TOOL_SEARCH": "maybe", "ENABLE_TOOL_SEARCH": "auto"}}',
      filename: project,
    },
  ],
  invalid: [],
})

jsonTester.run('settings-env-value-format (invalid)', rule, {
  valid: [],
  invalid: [
    // `env` is not an object, in each file. The report is on the value of `env`.
    ...ALL.flatMap((filename) =>
      [
        ['"x"', 'a string'],
        ['[1]', 'an array'],
        ['null', 'null'],
        ['1', 'a number'],
        ['true', 'a Boolean'],
      ].map(([value, type]) => ({
        code: `{"env": ${value}}`,
        filename,
        errors: [{ messageId: 'envNotObject' as const, data: { type }, line: 1, column: 9 }],
      })),
    ),
    // A value that is not a string, in each file. The report is on the value.
    ...ALL.flatMap((filename) =>
      [
        ['null', 'null'],
        ['1', 'a number'],
        ['1.5', 'a number'],
        ['true', 'a Boolean'],
        ['false', 'a Boolean'],
        ['{"a": "b"}', 'an object'],
        ['["1"]', 'an array'],
      ].map(([value, type]) => ({
        code: `{"env": {"FOO": ${value}}}`,
        filename,
        errors: [
          {
            messageId: 'notString' as const,
            data: { name: 'FOO', type },
            line: 1,
            column: 17,
          },
        ],
      })),
    ),
    // A known variable with a number is a value that is not a string, and not a bad form.
    {
      code: '{"env": {"CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS": 5}}',
      filename: project,
      errors: [{ messageId: 'notString' as const }],
    },
    // A drop-in with the name of a project file is a managed file.
    ...['managed-settings.d/settings.json', 'managed-settings.d/settings.local.json'].map(
      (filename) => ({
        code: '{"env": {"FOO": 1}}',
        filename,
        errors: [{ messageId: 'notString' as const }],
      }),
    ),
    // A hidden name outside the directory is no drop-in.
    {
      code: '{"env": {"FOO": 1}}',
      filename: '.claude/.settings.local.json',
      errors: [{ messageId: 'notString' as const }],
    },
    // A known variable whose value breaks its form, in each file. The report is on the value.
    ...FORMS.flatMap(({ name, fail, expected }) =>
      fail.flatMap((value) =>
        [project, managed].map((filename) => ({
          code: env({ [name]: value }),
          filename,
          errors: [{ messageId: 'badForm' as const, data: { name, expected }, line: 1 }],
        })),
      ),
    ),
    ...CAPABILITY_VARIABLES.map((name) => ({
      code: env({ [name]: 'effort,reasoning' }),
      filename: local,
      errors: [{ messageId: 'badForm' as const }],
    })),
    // The text of each message.
    {
      code: '{"model": "m", "env": "x"}',
      filename: local,
      errors: [
        {
          message:
            'Claude Code reads "env" as an object of variable names and string values, not a string.',
        },
      ],
    },
    {
      code: '{"model": "m", "env": {"FOO": 1}}',
      filename: local,
      errors: [{ message: 'The value of "FOO" must be a string, not a number.' }],
    },
    {
      code: '{"env": {"ENABLE_TOOL_SEARCH": "maybe"}}',
      filename: local,
      errors: [
        {
          message:
            'The value of "ENABLE_TOOL_SEARCH" must be a Boolean word such as true or false, auto, or auto:N with N from 0 to 100.',
        },
      ],
    },
    // One report for each fault.
    {
      code: '{"env": {"FOO": null, "ENABLE_TOOL_SEARCH": "maybe", "BAR": "ok", "MCP_SDK_GENERATION": "v3"}}',
      filename: project,
      errors: [
        { messageId: 'notString' as const },
        { messageId: 'badForm' as const },
        { messageId: 'badForm' as const },
      ],
    },
    // Two keys of one name. The rule reads the last.
    {
      code: '{"env": {"FOO": "1", "FOO": 1}}',
      filename: project,
      errors: [{ messageId: 'notString' as const, column: 29 }],
    },
    {
      code: '{"env": {"ENABLE_TOOL_SEARCH": "auto", "ENABLE_TOOL_SEARCH": "maybe"}}',
      filename: project,
      errors: [{ messageId: 'badForm' as const, column: 62 }],
    },
    {
      code: '{"env": {"FOO": "1"}, "env": []}',
      filename: project,
      errors: [{ messageId: 'envNotObject' as const, column: 30 }],
    },
  ],
})

// Red first: the form is not in the data module yet, so the case is expected to fail.
describe('CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH (red)', () => {
  it.fails('reports a value that is not a positive whole number in plain digits', () => {
    const code = env({ CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH: '0' })
    expect(lintJson('settings-env-value-format', code, managed).map((m) => m.messageId)).toEqual([
      'badForm',
    ])
  })
})
