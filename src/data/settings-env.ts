// The `env` variables that Claude Code reads from a settings file, and the forms of their
// values. Sources: the env vars reference (https://code.claude.com/docs/en/env-vars#variables),
// the entry for `env` in the settings reference
// (https://code.claude.com/docs/en/settings-reference#variables-claude-code-ignores-in-env),
// and the server-managed settings page
// (https://code.claude.com/docs/en/server-managed-settings#environment-variables-and-the-approval-dialog),
// checked on Claude Code 2.1.295 on 2026-10-08. Review these lists on or before 2027-04-08,
// the `stale_after` date of docs/rules/settings-env-credential.md.

/** The variables that hold an authentication credential. The server-managed settings page
 *  lists them as "Authentication credentials". `CLAUDE_CODE_CLIENT_KEY` is not here. It holds
 *  the path to a key file, not a credential. */
export const CREDENTIAL_ENV_VARS: readonly string[] = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'CLAUDE_CODE_OAUTH_TOKEN',
]

/** The variable that holds `Name: Value` header lines, one for each line. */
export const CUSTOM_HEADERS_VAR = 'ANTHROPIC_CUSTOM_HEADERS'

/** The header names that carry a credential, as the docs write them. Claude Code sends
 *  `ANTHROPIC_API_KEY` as `X-Api-Key` and `ANTHROPIC_AUTH_TOKEN` as `Authorization`. */
export const CREDENTIAL_HEADERS: readonly string[] = ['Authorization', 'X-Api-Key']

// The forms of the values of known variables. Sources: the row of each variable in the env vars
// reference, the tool search table of the MCP page, the memory limit section of the tools
// reference, and the capabilities table of the model configuration page. A variable that the
// docs name without a rule for other spellings has no form here. These are
// `CLAUDE_CODE_FORK_SUBAGENT` and `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`, which the docs set to
// `1` or `0`.

/** The form of the value of one variable. */
export interface EnvForm {
  /** What the value must be, to finish the sentence "The value must be ...". */
  expected: string
  accepts: (value: string) => boolean
}

const PLAIN_DIGITS = /^\d+$/

const positiveWhole: EnvForm = {
  expected: 'a positive whole number in plain digits',
  accepts: (value) => PLAIN_DIGITS.test(value) && Number(value) > 0,
}

const oneOf = (expected: string, values: readonly string[]): EnvForm => ({
  expected,
  accepts: (value) => values.includes(value),
})

const listOf = (values: readonly string[]) => (value: string) =>
  value.split(',').every((entry) => values.includes(entry.trim()))

const CGROUP_KINDS = ['mcp', 'lsp', 'hooks', 'plugin', 'helper', 'agent']

const CAPABILITIES = [
  'effort',
  'xhigh_effort',
  'max_effort',
  'thinking',
  'adaptive_thinking',
  'interleaved_thinking',
]

const CAPABILITIES_FORM: EnvForm = {
  expected: `a comma-separated list of ${CAPABILITIES.join(', ')}`,
  accepts: listOf(CAPABILITIES),
}

/** The `_SUPPORTED_CAPABILITIES` variables of the pinned models. */
const CAPABILITIES_VARIABLE =
  /^ANTHROPIC_(?:DEFAULT_[A-Z]+_MODEL|CUSTOM_MODEL_OPTION)_SUPPORTED_CAPABILITIES$/

const PROMPT_CACHE_TTL = oneOf('5m or 1h', ['5m', '1h'])

const FORMS = new Map<string, EnvForm>([
  ['CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH', positiveWhole],
  ['CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS', positiveWhole],
  ['CLAUDE_CODE_WEBFETCH_CACHE_TTL_MS', positiveWhole],
  [
    'CLAUDE_CODE_AUTO_COMPACT_WINDOW',
    {
      expected: 'a plain integer from 100000 to 1000000',
      accepts: (value) =>
        PLAIN_DIGITS.test(value) && Number(value) >= 100000 && Number(value) <= 1000000,
    },
  ],
  [
    'BASH_MAX_OUTPUT_LENGTH',
    {
      expected: 'at most 150000',
      accepts: (value) => !(PLAIN_DIGITS.test(value) && Number(value) > 150000),
    },
  ],
  [
    'CLAUDE_CODE_TOOL_MEMORY_LIMIT',
    {
      expected:
        'a size in plain digits with an optional K, M, G or T suffix, or one of 0, off, false, no, none',
      accepts: (value) =>
        /^\d+[KMGT]?$/i.test(value) || ['off', 'false', 'no', 'none'].includes(value.toLowerCase()),
    },
  ],
  [
    'CLAUDE_CODE_TOOL_MEMORY_CGROUP_EXCLUDE',
    {
      expected: `none, all-new, or a comma-separated list of ${CGROUP_KINDS.join(', ')}`,
      accepts: (value) => value === 'none' || value === 'all-new' || listOf(CGROUP_KINDS)(value),
    },
  ],
  [
    'ENABLE_TOOL_SEARCH',
    {
      expected: 'true, false, auto, or auto:N with N from 0 to 100',
      accepts: (value) =>
        ['true', 'false', 'auto'].includes(value) ||
        (/^auto:\d+$/.test(value) && Number(value.slice('auto:'.length)) <= 100),
    },
  ],
  ['MCP_SDK_GENERATION', oneOf('v1 or v2', ['v1', 'v2'])],
  ['MCP_PROTOCOL_NEGOTIATION', oneOf('auto or legacy', ['auto', 'legacy'])],
  ['CLAUDE_CODE_PROMPT_CACHE_TTL', PROMPT_CACHE_TTL],
  ['CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL', PROMPT_CACHE_TTL],
  [
    'CLAUDE_CODE_EFFORT_LEVEL',
    oneOf('low, medium, high, xhigh, max or auto', [
      'low',
      'medium',
      'high',
      'xhigh',
      'max',
      'auto',
    ]),
  ],
  [
    'CLAUDE_CODE_SHELL',
    {
      expected: 'a path to a bash or zsh binary',
      accepts: (value) => /(?:^|[\\/])(?:bash|zsh)(?:\.exe)?$/.test(value),
    },
  ],
])

/** The form of the value of the variable `name`, if the docs give it one. A value of `""`
 *  cancels a shell value, and is valid for every variable. */
export function envValueForm(name: string): EnvForm | undefined {
  return CAPABILITIES_VARIABLE.test(name) ? CAPABILITIES_FORM : FORMS.get(name)
}
