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

// The variables that a settings file cannot set. Sources: "Variables Claude Code ignores in
// env" in the settings reference, and the rows of the env vars reference.

/** Variables that Claude Code ignores in the `env` block of every settings file. The settings
 *  reference names the identity variables of the hosting environments, and the variables that
 *  Claude Code exports or reads from the launch environment only. */
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
 *  `none` for the three exporter selectors, and an off value for three content variables. A
 *  value has no letter case. `OTEL_LOG_MANAGED_SETTINGS` has the same exception. The env vars
 *  reference says that a project value does not turn it on. */
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
