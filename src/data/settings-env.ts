// The `env` variables that Claude Code reads from a settings file, and the forms of their
// values. Sources: the env vars reference (https://code.claude.com/docs/en/env-vars#variables),
// the entry for `env` in the settings reference
// (https://code.claude.com/docs/en/settings-reference#variables-claude-code-ignores-in-env),
// and the server-managed settings page
// (https://code.claude.com/docs/en/server-managed-settings#environment-variables-and-the-approval-dialog),
// checked on Claude Code 2.1.307 on 2026-10-21. Review these lists on or before 2027-04-08,
// the `stale_after` date of docs/rules/settings-env-credential.md.

// The first Claude Code version that reads a variable. Source: the sentence "Requires Claude Code
// vX or later" in the row of a variable in the env vars reference
// (https://code.claude.com/docs/en/env-vars#variables). The review date is 2026-10-19, against
// the stored text in docs/docs-snapshot/env-vars.json. The list holds each variable where the
// sentence covers the whole variable and X is v2.1.211 or later. This is the range that
// `settings-env-numeric-spelling` needs. The list leaves out a sentence for one part of a
// variable (`BASH_DEFAULT_TIMEOUT_MS`, `BASH_MAX_TIMEOUT_MS` and `MCP_DISCOVERY_CACHE`). Review it
// on or before 2027-04-08, with the lists above.
// `tests/settings-env.test.ts` checks the list against the stored text.

/** The first Claude Code version that reads each variable, when that version is v2.1.211 or later.
 *  A variable that is not here is old, or the docs give no whole-variable "Requires" sentence. */
const ENV_FIRST_VERSIONS = new Map<string, string>([
  ['ANTHROPIC_BEDROCK_REGION_PREFIX', '2.1.224'],
  ['ANTHROPIC_CUSTOM_HEADERS', '2.1.227'],
  ['ANTHROPIC_DEFAULT_MODEL', '2.1.236'],
  ['CLAUDE_AX_PREPARK_MS', '2.1.233'],
  ['CLAUDE_AX_STARTUP_QUIET_MS', '2.1.217'],
  ['CLAUDE_CODE_ARTIFACT_COMMENTS', '2.1.221'],
  ['CLAUDE_CODE_ARTIFACT_COMMENTS_AUTOREACT', '2.1.228'],
  ['CLAUDE_CODE_ARTIFACT_PUBLISH_EDITS', '2.1.300'],
  ['CLAUDE_CODE_AUTO_MODE_MODEL', '2.1.302'],
  ['CLAUDE_CODE_AUTO_MODE_SERVER', '2.1.271'],
  ['CLAUDE_CODE_BASH_EDIT_DIFF', '2.1.269'],
  ['CLAUDE_CODE_DISABLE_ADMIN_ENV_UNION', '2.1.223'],
  ['CLAUDE_CODE_DISABLE_AUTH_REFRESH_LOCK', '2.1.286'],
  ['CLAUDE_CODE_DISABLE_BEDROCK_CONTENT_TYPE_DEFAULT', '2.1.239'],
  ['CLAUDE_CODE_DISABLE_CFC_PROMPT', '2.1.257'],
  ['CLAUDE_CODE_DISABLE_DANGEROUS_RM_TIMEOUT', '2.1.281'],
  ['CLAUDE_CODE_DISABLE_FILE_MENTIONS', '2.1.299'],
  ['CLAUDE_CODE_DISABLE_INLINE_SHELL_RM_PROMPT', '2.1.288'],
  ['CLAUDE_CODE_DISABLE_MCP_TASK_BACKGROUND', '2.1.304'],
  ['CLAUDE_CODE_DISABLE_MODEL_ACCESS_FALLBACK', '2.1.285'],
  ['CLAUDE_CODE_DISABLE_MOUNTED_DRIVE_RM_PROMPT', '2.1.304'],
  ['CLAUDE_CODE_DISABLE_MTLS_RELOAD_ON_STALE_CONNECTION', '2.1.232'],
  ['CLAUDE_CODE_DISABLE_PERMISSION_PROMPT_NOTIFY_HOOKS', '2.1.233'],
  ['CLAUDE_CODE_DISABLE_POWERSHELL_CMD_RM_DENY', '2.1.283'],
  ['CLAUDE_CODE_DISABLE_STRUCTURED_OUTPUTS', '2.1.288'],
  ['CLAUDE_CODE_DISABLE_SUBSTITUTION_RM_PROMPT', '2.1.281'],
  ['CLAUDE_CODE_DISABLE_UNKNOWN_MODEL_WINDOW_ENFORCEMENT', '2.1.223'],
  ['CLAUDE_CODE_DISABLE_ULTRAREVIEW_TRUST_CHECK', '2.1.309'],
  ['CLAUDE_CODE_DISABLE_WEB_FETCH', '2.1.285'],
  ['CLAUDE_CODE_DISABLE_WINDOWS_SHELL_LAUNCHER', '2.1.269'],
  ['CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION', '2.1.238'],
  ['CLAUDE_CODE_ENABLE_SHARE_BUNDLE', '2.1.299'],
  ['CLAUDE_CODE_ENABLE_TODO_TOOLS', '2.1.233'],
  ['CLAUDE_CODE_FORWARD_SUBAGENT_TEXT', '2.1.211'],
  ['CLAUDE_CODE_GATEWAY_HINT_HEADERS', '2.1.273'],
  ['CLAUDE_CODE_GATEWAY_MODEL_DISCOVERY_TIMEOUT_MS', '2.1.269'],
  ['CLAUDE_CODE_GOAL_CHECKIN_MINUTES', '2.1.234'],
  ['CLAUDE_CODE_IDLE_COMPACT_MIN_TOKENS', '2.1.290'],
  ['CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS', '2.1.217'],
  ['CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH', '2.1.280'],
  ['CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH', '2.1.217'],
  ['CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION', '2.1.212'],
  ['CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS', '2.1.212'],
  ['CLAUDE_CODE_MCP_STARTUP_WAIT_MS', '2.1.274'],
  ['CLAUDE_CODE_MESSAGING_SOCKET', '2.1.224'],
  ['CLAUDE_CODE_MESSAGING_TOKEN', '2.1.228'],
  ['CLAUDE_CODE_NONBLOCKING_STDOUT', '2.1.261'],
  ['CLAUDE_CODE_NONSTREAMING_TIMEOUT_RETRIES', '2.1.285'],
  ['CLAUDE_CODE_OTEL_CONTENT_MAX_LENGTH', '2.1.214'],
  ['CLAUDE_CODE_OVERLOADED_RETRY_BASE_DELAY_MS', '2.1.292'],
  ['CLAUDE_CODE_OVERLOADED_RETRY_MAX_DELAY_MS', '2.1.296'],
  ['CLAUDE_CODE_PLUGIN_DIRS', '2.1.280'],
  ['CLAUDE_CODE_PLUGIN_DIR_WATCH', '2.1.287'],
  ['CLAUDE_CODE_PROJECT_DIR_NAME', '2.1.234'],
  ['CLAUDE_CODE_PROMPT_CACHE_TTL', '2.1.242'],
  ['CLAUDE_CODE_RESTRICTED', '2.1.248'],
  ['CLAUDE_CODE_RESUME_INTERRUPTED_TURN_MAX_AGE_MS', '2.1.211'],
  ['CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS', '2.1.295'],
  ['CLAUDE_CODE_RETRY_WATCHDOG_USAGE_LIMIT_RECHECK_MS', '2.1.305'],
  ['CLAUDE_CODE_SKIP_MODEL_ACCESS_MEMORY', '2.1.285'],
  ['CLAUDE_CODE_STARTUP_FAILURE_RESULTS', '2.1.274'],
  ['CLAUDE_CODE_SUBAGENT_MODEL_FORCE', '2.1.257'],
  ['CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL', '2.1.242'],
  ['CLAUDE_CODE_TOOL_MEMORY_CGROUP_EXCLUDE', '2.1.246'],
  ['CLAUDE_CODE_TOOL_MEMORY_LIMIT', '2.1.233'],
  ['CLAUDE_CODE_TRANSCRIPT_LOCAL_GC', '2.1.287'],
  ['CLAUDE_CODE_WARN_DISK_FREE_GIB', '2.1.304'],
  ['CLAUDE_CODE_WARN_MEMORY_FREE_GIB', '2.1.304'],
  ['CLAUDE_CODE_WEBFETCH_CACHE_TTL_MS', '2.1.233'],
  ['CLAUDE_CODE_WEBFETCH_DEADLINE_MS', '2.1.268'],
  ['CLAUDE_CODE_WEB_SEARCH_REFILLS_PER_HOUR', '2.1.290'],
  ['CLAUDE_CODE_WORKER_CHECKIN_SCHEDULE', '2.1.283'],
  ['CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS', '2.1.269'],
  ['CLAUDE_CODE_WORKFLOW_PREFIX_STAGGER_MS', '2.1.229'],
  ['CLAUDE_CODE_YOU_SHOULD_KNOW_DEBUG', '2.1.287'],
  ['CLAUDE_PID', '2.1.214'],
  ['CLAUDE_STREAM_FIRST_BYTE_TIMEOUT_MS', '2.1.242'],
  ['MCP_DISCOVERY_CACHE_STRIKES', '2.1.238'],
  ['MCP_PROTOCOL_NEGOTIATION', '2.1.221'],
  ['MCP_SDK_GENERATION', '2.1.218'],
  ['OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT', '2.1.214'],
  ['OTEL_LOG_MANAGED_SETTINGS', '2.1.274'],
  ['OTEL_METRICS_INCLUDE_REPOSITORY', '2.1.269'],
])

/** The first Claude Code version that reads `name`. It is `undefined` when the list has no
 *  entry, that is, when the docs name no version of v2.1.211 or later. */
export const envFirstVersion = (name: string): string | undefined => ENV_FIRST_VERSIONS.get(name)

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
// `CLAUDE_CODE_FORK_SUBAGENT` (the docs give `0`) and
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

/** True when `value` is in plain digits, from `min` to `max`. */
const isPlainFrom = (value: string, min: number, max: number) =>
  PLAIN_DIGITS.test(value) && Number(value) >= min && Number(value) <= max

const plainFrom = (min: number, max: number): EnvForm => ({
  expected: `a whole number from ${min} to ${max} in plain digits`,
  accepts: (value) => isPlainFrom(value, min, max),
})

const plainWhole: EnvForm = {
  expected: 'a whole number in plain digits',
  accepts: (value) => PLAIN_DIGITS.test(value),
}

// A numeric variable takes these spellings, unless its row says plain digits only.
const NUMBER_SPELLING = /^\d+(?:_\d+)*$|^\d+(?:\.\d+)?[eE][+-]?\d+$/

/** True when `value` spells a whole number: plain digits, digits with separators, or scientific
 *  notation such as `2e3`. */
const isWholeNumber = (value: string) =>
  NUMBER_SPELLING.test(value) && Number.isInteger(Number(value.replaceAll('_', '')))

const POSITIVE_WHOLE_NUMBER: EnvForm = {
  expected: 'a positive whole number',
  accepts: (value) => isWholeNumber(value) && Number(value.replaceAll('_', '')) > 0,
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

/** True when the settings object `fields` sets the `env` variable `variable` to an on value. */
export function envIsOn(fields: Record<string, unknown>, variable: string): boolean {
  const { env } = fields
  const value =
    env !== null && typeof env === 'object' ? (env as Record<string, unknown>)[variable] : undefined
  return typeof value === 'string' && isEnvOn(value)
}

const PROMPT_CACHE_TTL = oneOf('5m or 1h', ['5m', '1h'])

const FORMS = new Map<string, EnvForm>([
  ['CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH', positiveWhole],
  ['CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS', positiveWhole],
  ['CLAUDE_CODE_WEBFETCH_CACHE_TTL_MS', positiveWhole],
  [
    'CLAUDE_CODE_AUTO_COMPACT_WINDOW',
    {
      expected: 'plain digits, with an optional k or M suffix, from 100000 to 1000000 tokens',
      // The suffix k means 1000 times the number and M means 1000000 times, in any letter case. The env vars row
      // says "Suffixed values such as 200k require v2.1.304 or later". The rule has no version
      // option, so it accepts the suffix.
      accepts: (value) => {
        if (!/^\d+[kKmM]?$/.test(value)) return false
        const factor = /k$/i.test(value) ? 1000 : /m$/i.test(value) ? 1000000 : 1
        const tokens = Number(value.replace(/[kKmM]$/, '')) * factor
        return tokens >= 100000 && tokens <= 1000000
      },
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
  ['CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH', positiveWhole],
  // Claude Code raises a value below 100000 to 100000, so a low value is valid.
  ['CLAUDE_CODE_IDLE_COMPACT_MIN_TOKENS', POSITIVE_WHOLE_NUMBER],
  ['CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION', POSITIVE_WHOLE_NUMBER],
  ['CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS', positiveWhole],
  ['CLAUDE_CODE_GATEWAY_MODEL_DISCOVERY_TIMEOUT_MS', positiveWhole],
  ['CLAUDE_CODE_OVERLOADED_RETRY_BASE_DELAY_MS', plainFrom(500, 32000)],
  ['CLAUDE_CODE_OVERLOADED_RETRY_MAX_DELAY_MS', plainFrom(32000, 64000)],
  // `0` turns the check-ins off.
  ['CLAUDE_CODE_GOAL_CHECKIN_MINUTES', plainFrom(0, 10080)],
  ['CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS', plainFrom(1, 256)],
  // For these two, `0` removes the limit or turns the refill off.
  ['CLAUDE_CODE_WEBFETCH_DEADLINE_MS', plainWhole],
  ['CLAUDE_CODE_WEB_SEARCH_REFILLS_PER_HOUR', plainWhole],
  [
    'CLAUDE_CODE_WORKER_CHECKIN_SCHEDULE',
    {
      expected: 'a comma-separated list of whole seconds from 1 to 86400 in plain digits',
      accepts: (value) => value.split(',').every((entry) => isPlainFrom(entry, 1, 86400)),
    },
  ],
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
  'CLAUDE_CODE_DISABLE_MOUNTED_DRIVE_RM_PROMPT',
  'CLAUDE_CODE_DISABLE_ADMIN_ENV_UNION',
  'CLAUDE_CODE_WARN_DISK_FREE_GIB',
  'CLAUDE_CODE_WARN_MEMORY_FREE_GIB',
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
  // The timer of an unanswered dialog, the attachment switch, and the file mention switch.
  'CLAUDE_CODE_USER_DIALOG_TIMEOUT_MS',
  'CLAUDE_CODE_DISABLE_ATTACHMENTS',
  'CLAUDE_CODE_DISABLE_FILE_MENTIONS',
  // The screen reader variable and the other variables whose names start with CLAUDE_AX_.
  /^CLAUDE_AX_/,
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

/** The variables that Claude Code ignores in project and local settings for some values only,
 *  and those values. The env vars reference says that Claude Code ignores `1` for
 *  `CLAUDE_CODE_ENABLE_CFC`. The docs name no other value, so the match is exact. */
const IGNORED_VALUES_IN_PROJECT_FILES = new Map<string, readonly string[]>([
  ['CLAUDE_CODE_ENABLE_CFC', ['1']],
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

/** True when the docs say that Claude Code ignores the value `value` of the variable `name` in a
 *  project or local file. */
export function ignoresValueInProjectFiles(name: string, value: string): boolean {
  return IGNORED_VALUES_IN_PROJECT_FILES.get(name)?.includes(value) ?? false
}

/** The Claude Code version from which the variable `name` has no effect, if it is removed. */
export function removedEnvVarSince(name: string): string | undefined {
  return REMOVED_ENV_VARS.get(name)
}

// The variables that the settings env rules read. Sources: the env vars reference, the prompt caching page
// (https://code.claude.com/docs/en/prompt-caching#disable-prompt-caching) and the server-managed
// settings page
// (https://code.claude.com/docs/en/server-managed-settings#environment-variables-and-the-approval-dialog),
// checked on Claude Code 2.1.296 on 2026-10-11.

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
// Code 2.1.296 on 2026-10-10. The docs state these forms less firmly than those in `FORMS`. A row
// in `FORMS` gives a form, such as plain digits or a range. These rows give only a unit and a
// default, or the values to set. So these forms are not in `FORMS`, and
// `settings-env-value-format` does not report them. The text above the table says that a numeric
// variable accepts a scientific spelling or digit separators. A row that says plain digits is the
// exception, and none of these rows says so.

const WHOLE_MILLISECONDS: EnvForm = {
  expected: 'a whole number of milliseconds',
  accepts: isWholeNumber,
}

const HEURISTIC_FORMS = new Map<string, EnvForm>([
  ['MAX_MCP_OUTPUT_TOKENS', POSITIVE_WHOLE_NUMBER],
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
 *  reference lists them among the variables that Claude Code ignores in project settings, and does
 *  not say that they hold a path. */
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
