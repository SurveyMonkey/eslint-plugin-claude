// The `env` variables that Claude Code reads from a settings file, and the forms of their
// values. Sources: the env vars reference (https://code.claude.com/docs/en/env-vars#variables),
// the entry for `env` in the settings reference
// (https://code.claude.com/docs/en/settings-reference#variables-claude-code-ignores-in-env),
// and the server-managed settings page
// (https://code.claude.com/docs/en/server-managed-settings#environment-variables-and-the-approval-dialog),
// checked on Claude Code 2.1.295 on 2026-10-08. Review these lists on or before 2027-04-08,
// the `stale_after` date of docs/rules/settings-env-credential.md.

/** The variables that hold an authentication credential. Rows of the env vars reference:
 *  an API key, a value for the `Authorization` header, and an OAuth access token.
 *  `CLAUDE_CODE_CLIENT_KEY` is not here. It holds the path to a key file, not a credential. */
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
// `CLAUDE_CODE_FORK_SUBAGENT` (the docs give `1` or `0`) and
// `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` (the docs give `1`).

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

// The tools reference says that Claude Code ignores a kind name that it does not know. The form
// checks the shape of each name, not the name.
const KIND_NAME = /^[A-Za-z][A-Za-z0-9_-]*$/

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

// The env vars reference: a variable that turns a behavior on or off takes one of these, in any
// casing.
const ON_WORDS = ['1', 'true', 'yes', 'on']
const OFF_WORDS = ['0', 'false', 'no', 'off']
const BOOLEAN_WORDS = [...ON_WORDS, ...OFF_WORDS]

/** True when `value` turns a behavior on: `1`, `true`, `yes` or `on`, with any letter case. */
export const isEnvOn = (value: string) => ON_WORDS.includes(value.toLowerCase())

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
      expected: 'none, all-new, or a comma-separated list of kind names such as mcp, lsp or hooks',
      accepts: (value) =>
        value === 'none' ||
        value === 'all-new' ||
        value.split(',').every((entry) => KIND_NAME.test(entry.trim())),
    },
  ],
  [
    'ENABLE_TOOL_SEARCH',
    {
      expected: 'a Boolean word such as true or false, auto, or auto:N with N from 0 to 100',
      accepts: (value) => {
        const word = value.toLowerCase()
        return (
          BOOLEAN_WORDS.includes(word) ||
          word === 'auto' ||
          (/^auto:\d+$/.test(word) && Number(word.slice('auto:'.length)) <= 100)
        )
      },
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

// The variables that a settings file cannot set. Sources: "Variables Claude Code ignores in
// env" in the settings reference, and the rows of the env vars reference.

/** Variables that Claude Code ignores in the `env` block of every settings file. The settings
 *  reference names two kinds. Host platforms own the identity variables. Claude Code exports
 *  the others, or reads them from the launch environment only. */
const IGNORED_IN_EVERY_FILE = new Set([
  'CLAUDE_CODE_REMOTE',
  'CLAUDE_CODE_ACCOUNT_UUID',
  'CLAUDE_CODE_MESSAGING_SOCKET',
  'CLAUDE_CODE_MESSAGING_TOKEN',
  'CLAUDE_CODE_PROJECT_DIR_NAME',
  'CLAUDE_CODE_RESTRICTED',
  'CLAUDE_CODE_DISABLE_POWERSHELL_CMD_RM_DENY',
  'CLAUDE_CODE_DISABLE_DANGEROUS_RM_TIMEOUT',
  'CLAUDE_CODE_DISABLE_SUBSTITUTION_RM_PROMPT',
  'CLAUDE_CODE_DISABLE_INLINE_SHELL_RM_PROMPT',
  'CLAUDE_CODE_DISABLE_ADMIN_ENV_UNION',
])

/** Variables that Claude Code ignores in project and local settings. The user, managed and
 *  `--settings` files can set them. A name is a variable, or a family of variables. The
 *  Windows names have the letter case of the settings reference. */
const IGNORED_IN_PROJECT_FILES: readonly (string | RegExp)[] = [
  // Where Claude Code stores its files, and the operating-system directories.
  'CLAUDE_CONFIG_DIR',
  'CLAUDE_CODE_TMPDIR',
  'HOME',
  'TMPDIR',
  'TMP',
  'TEMP',
  /^XDG_/,
  // Windows variables that pick the programs and the machine-wide configuration.
  'SystemRoot',
  'ComSpec',
  'ProgramData',
  'LOCALAPPDATA',
  'PATHEXT',
  'PSModulePath',
  /^ProgramFiles(?:\(x86\))?$/,
  // Variables that export session content.
  'OTEL_LOG_RAW_API_BODIES',
  'ENABLE_BETA_TRACING_DETAILED',
  'BETA_TRACING_ENDPOINT',
  // The OpenTelemetry exporter variables that turn telemetry on, choose where it goes, or
  // choose what content it captures. The exporter variables of the generic and the per-signal
  // forms end in one of six words.
  'CLAUDE_CODE_ENABLE_TELEMETRY',
  'CLAUDE_CODE_ENHANCED_TELEMETRY_BETA',
  'ENABLE_ENHANCED_TELEMETRY_BETA',
  'OTEL_LOGS_EXPORTER',
  'OTEL_METRICS_EXPORTER',
  'OTEL_TRACES_EXPORTER',
  'OTEL_LOG_USER_PROMPTS',
  'OTEL_LOG_ASSISTANT_RESPONSES',
  'OTEL_LOG_TOOL_CONTENT',
  'OTEL_LOG_TOOL_DETAILS',
  'OTEL_LOG_MANAGED_SETTINGS',
  /^OTEL_EXPORTER_OTLP_(?:.+_)?(?:ENDPOINT|HEADERS|PROTOCOL|CERTIFICATE|CLIENT_KEY|INSECURE)$/,
  'OTEL_EXPORTER_PROMETHEUS_HOST',
  'OTEL_EXPORTER_PROMETHEUS_PORT',
  // Variables that change how Claude Code starts or syncs.
  'CLAUDE_CODE_PROCESS_WRAPPER',
  'CLAUDE_CODE_SYNC_SKILLS',
  'CLAUDE_CODE_SYNC_PLUGINS',
  'CLAUDE_CODE_PLUGIN_CACHE_DIR',
  'CLAUDE_CODE_PLUGIN_SEED_DIR',
  // The timers of an unanswered dialog, and the attachment switch.
  'CLAUDE_CODE_USER_DIALOG_TIMEOUT_MS',
  'CLAUDE_AFK_TIMEOUT_MS',
  'CLAUDE_AFK_COUNTDOWN_MS',
  'CLAUDE_CODE_DISABLE_ATTACHMENTS',
]

/** The values that still apply from a project or local file, because they turn telemetry off:
 *  `none` for the three exporter selectors, and an off value for three content variables. The
 *  letter case of a value does not matter. The plugin gives `OTEL_LOG_MANAGED_SETTINGS` the same
 *  exception. The docs name none. The env vars reference says that a project value does not
 *  turn it on, so an off value changes nothing. */
const OFF_VALUES = ['0', 'false', 'no', 'off']
const TELEMETRY_OFF_VALUES = new Map<string, readonly string[]>([
  ['OTEL_LOGS_EXPORTER', ['none']],
  ['OTEL_METRICS_EXPORTER', ['none']],
  ['OTEL_TRACES_EXPORTER', ['none']],
  ['OTEL_LOG_USER_PROMPTS', OFF_VALUES],
  ['OTEL_LOG_TOOL_CONTENT', OFF_VALUES],
  ['OTEL_LOG_TOOL_DETAILS', OFF_VALUES],
  ['OTEL_LOG_MANAGED_SETTINGS', OFF_VALUES],
])

/** Variables that Claude Code removed, or accepts and ignores, and the version from which they
 *  have no effect. `CLAUDE_CODE_ENABLE_AUTO_MODE` was required in v2.1.158 through v2.1.206. */
const REMOVED_ENV_VARS = new Map<string, string>([
  ['CLAUDE_CODE_CONNECT_TIMEOUT_MS', '2.1.186'],
  ['CLAUDE_CODE_ENABLE_OPUS_4_7_FAST_MODE', '2.1.142'],
  ['CLAUDE_CODE_OPUS_4_6_FAST_MODE_OVERRIDE', '2.1.160'],
  ['CLAUDE_CODE_MAX_SUBAGENTS_PER_SESSION', '2.1.224'],
  ['CLAUDE_SUBAGENT_BG_SHELL_MAX_MS', '2.1.260'],
  ['TASK_MAX_OUTPUT_LENGTH', '2.1.277'],
  ['CLAUDE_CODE_ENABLE_AUTO_MODE', '2.1.207'],
  ['CLAUDE_CODE_AUTO_BACKGROUND_WORKER_CHECKIN_SECONDS', '2.1.283'],
])

/** The files that Claude Code ignores the variable `name` in: every settings file, or the
 *  project and local files. It is undefined for a variable that a settings file may set. */
export function envIgnoredIn(name: string): 'every-file' | 'project-files' | undefined {
  if (IGNORED_IN_EVERY_FILE.has(name)) {
    return 'every-file'
  }
  return IGNORED_IN_PROJECT_FILES.some((entry) =>
    typeof entry === 'string' ? entry === name : entry.test(name),
  )
    ? 'project-files'
    : undefined
}

/** True when a project or local file can set the variable `name` to `value`, in spite of
 *  `envIgnoredIn`: the value turns telemetry off. */
export function turnsTelemetryOff(name: string, value: string): boolean {
  return TELEMETRY_OFF_VALUES.get(name)?.includes(value.toLowerCase()) ?? false
}

/** The Claude Code version from which the variable `name` has no effect, if it is removed. */
export function removedEnvVarSince(name: string): string | undefined {
  return REMOVED_ENV_VARS.get(name)
}

// The variables that the settings env rules read. Sources: the env vars reference, the prompt caching page
// (https://code.claude.com/docs/en/prompt-caching#disable-prompt-caching) and the server-managed
// settings page
// (https://code.claude.com/docs/en/server-managed-settings#environment-variables-and-the-approval-dialog),
// checked on Claude Code 2.1.296 on 2026-10-10.

/** A variable that Claude Code keeps for compatibility, and what to say about it. `summary`
 *  finishes a sentence that starts with the variable name. `value` is set when only that value is
 *  a fault. The env vars reference marks `ANTHROPIC_SMALL_FAST_MODEL` and
 *  `ENABLE_PROMPT_CACHING_1H_BEDROCK` as deprecated, and calls `DISABLE_BUG_COMMAND` an older
 *  name and `SLASH_COMMAND_TOOL_CHAR_BUDGET` a legacy name. It names no replacement for
 *  `SLASH_COMMAND_TOOL_CHAR_BUDGET`.
 *  `CLAUDE_CODE_ENABLE_TASKS` set to `0` selects the legacy `TodoWrite` tool. */
interface DeprecatedEnvVar {
  summary: string
  value?: string
}

const DEPRECATED_ENV_VARS = new Map<string, DeprecatedEnvVar>([
  [
    'ANTHROPIC_SMALL_FAST_MODEL',
    { summary: 'is deprecated. Use "ANTHROPIC_DEFAULT_HAIKU_MODEL".' },
  ],
  [
    'ENABLE_PROMPT_CACHING_1H_BEDROCK',
    { summary: 'is deprecated. Use "ENABLE_PROMPT_CACHING_1H".' },
  ],
  ['DISABLE_BUG_COMMAND', { summary: 'is an older name. Use "DISABLE_FEEDBACK_COMMAND".' }],
  [
    'SLASH_COMMAND_TOOL_CHAR_BUDGET',
    { summary: 'is a legacy name that Claude Code keeps for backward compatibility.' },
  ],
  [
    'CLAUDE_CODE_ENABLE_TASKS',
    {
      summary:
        'set to "0" selects the legacy "TodoWrite" tool in place of the Task tools. Remove the variable to get the Task tools.',
      value: '0',
    },
  ],
])

/** The text that finishes a sentence about the variable `name` set to `value`, when Claude Code
 *  deprecates the variable or keeps it as a legacy name. It is undefined for another variable,
 *  and for a variable whose entry names a value other than `value`. */
export function deprecatedEnvSummary(name: string, value: string): string | undefined {
  const entry = DEPRECATED_ENV_VARS.get(name)
  return entry !== undefined && (entry.value === undefined || entry.value === value)
    ? entry.summary
    : undefined
}

/** The variables that send the traffic of Claude Code through a proxy, or add a certificate
 *  authority. The server-managed settings page names the proxy and TLS variables.
 *  The OpenTelemetry endpoint variable is not here: `settings-env-ignored-var` reports it in a
 *  project file. */
export const TRAFFIC_ENV_VARS: readonly string[] = [
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NODE_EXTRA_CA_CERTS',
]

/** The variables that select a model provider. Setting one bypasses server-managed settings. */
export const PROVIDER_ENV_VARS: readonly string[] = [
  'CLAUDE_CODE_USE_ANTHROPIC_AWS',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_FOUNDRY',
  'CLAUDE_CODE_USE_MANTLE',
  'CLAUDE_CODE_USE_VERTEX',
]

/** The variable that sets the API endpoint, and the host that is the default. A base URL with
 *  another host bypasses server-managed settings. */
export const BASE_URL_VAR = 'ANTHROPIC_BASE_URL'
export const DEFAULT_API_HOST = 'api.anthropic.com'

/** The variables that turn prompt caching off, when set on. */
export const PROMPT_CACHING_OFF_VARS: readonly string[] = [
  'DISABLE_PROMPT_CACHING',
  'DISABLE_PROMPT_CACHING_FABLE',
  'DISABLE_PROMPT_CACHING_HAIKU',
  'DISABLE_PROMPT_CACHING_OPUS',
  'DISABLE_PROMPT_CACHING_SONNET',
]

/** The four privacy toggles. The server-managed settings page says that Claude Code decides by the
 *  delivered value whether one needs approval: a truthy value such as `1` or `true` applies without
 *  the approval dialog, and any other non-empty value shows it. */
export const PRIVACY_TOGGLE_ENV_VARS: readonly string[] = [
  'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
  'DISABLE_ERROR_REPORTING',
  'DISABLE_TELEMETRY',
  'DO_NOT_TRACK',
]

// The variables of the heuristic env rules. Sources: the rows of the env vars reference, and the
// MCP page (https://code.claude.com/docs/en/mcp#mcp-output-limits-and-warnings), checked on Claude
// Code 2.1.296 on 2026-10-10. The docs state these forms less firmly than those in `FORMS`: they
// give a unit and a default. The text above the table says that a numeric variable accepts a
// scientific or digit-separator spelling, unless its row says plain digits only, and none of
// these rows says so. So these forms are not in `FORMS`, and `settings-env-value-format` does not
// report them.

const NUMBER_SPELLING = /^\d+(?:_\d+)*$|^\d+(?:\.\d+)?[eE][+-]?\d+$/

/** True when `value` spells a whole number: plain digits, digits with separators, or scientific
 *  notation such as `2e3`. */
const isWholeNumber = (value: string) =>
  NUMBER_SPELLING.test(value) && Number.isInteger(Number(value.replaceAll('_', '')))

const WHOLE_MILLISECONDS: EnvForm = {
  expected: 'a whole number of milliseconds',
  accepts: isWholeNumber,
}

const POSITIVE_WHOLE_TOKENS: EnvForm = {
  expected: 'a positive whole number',
  accepts: (value) => isWholeNumber(value) && Number(value.replaceAll('_', '')) > 0,
}

const HEURISTIC_FORMS = new Map<string, EnvForm>([
  ['MAX_MCP_OUTPUT_TOKENS', POSITIVE_WHOLE_TOKENS],
  ['MCP_TIMEOUT', WHOLE_MILLISECONDS],
  ['MCP_TOOL_TIMEOUT', WHOLE_MILLISECONDS],
  // The reference says to set `0` to turn the idle check or the move to a background task off.
  ['CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT', WHOLE_MILLISECONDS],
  ['CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS', WHOLE_MILLISECONDS],
  ['CLAUDE_CODE_USE_POWERSHELL_TOOL', oneOf('0 or 1', ['0', '1'])],
])

/** The form of the value of the variable `name`, for a variable that only the heuristic rule
 *  `settings-env-format-heuristic` checks. */
export function heuristicEnvForm(name: string): EnvForm | undefined {
  return HEURISTIC_FORMS.get(name)
}

/** The variables that hold the path to a key file or a certificate, and not a key. Their names end
 *  in `_KEY`. The env vars reference says that `CLAUDE_CODE_CLIENT_KEY` is the "path to client
 *  private key file". The rule reads `OTEL_EXPORTER_OTLP_*_CLIENT_KEY` the same way. The settings
 *  reference lists them among the exporter variables, and does not say that they hold a path. */
export function holdsKeyPath(name: string): boolean {
  return name === 'CLAUDE_CODE_CLIENT_KEY' || /^OTEL_EXPORTER_OTLP_(?:.+_)?CLIENT_KEY$/.test(name)
}

/** The shapes of a value that is a credential, whatever the name: an Anthropic API key
 *  (`sk-ant-`), a GitHub token, an AWS access key ID, a Slack token, and an `Authorization`
 *  value. The scrub list of the env vars reference says that a value which "looks like a
 *  credential" is a secret, and gives no shape. The shapes are the public prefixes of common
 *  services. */
const SECRET_VALUE_SHAPES: readonly RegExp[] = [
  /^sk-ant-/,
  /^(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})$/,
  /^(?:AKIA|ASIA)[A-Z0-9]{16}$/,
  /^xox[abprs]-/,
  /^Bearer\s+\S/,
]

/** True when `value` has the shape of a credential. */
export function looksLikeSecret(value: string): boolean {
  return SECRET_VALUE_SHAPES.some((shape) => shape.test(value))
}

/** True when the variable name ends in `_KEY`, `_TOKEN`, `_SECRET` or `_PASSWORD`. */
export function hasSecretName(name: string): boolean {
  return /_(?:KEY|TOKEN|SECRET|PASSWORD)$/i.test(name)
}

/** The variable that controls MCP tool search. A false value loads every MCP tool definition
 *  upfront. */
export const TOOL_SEARCH_VAR = 'ENABLE_TOOL_SEARCH'

/** The variable that forces the 5-minute prompt cache TTL. */
export const FORCE_CACHE_5M_VAR = 'FORCE_PROMPT_CACHING_5M'

/** True when `value` turns a behavior off: `0`, `false`, `no` or `off`, with any letter case. */
export const isEnvOff = (value: string) => OFF_WORDS.includes(value.toLowerCase())
