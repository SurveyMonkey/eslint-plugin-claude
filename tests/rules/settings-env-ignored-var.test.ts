// The expected values come from the entry for `env` in the settings reference, "Variables Claude
// Code ignores in env" (https://code.claude.com/docs/en/settings-reference#variables-claude-code-ignores-in-env),
// and from the rows of the env vars reference (https://code.claude.com/docs/en/env-vars#variables)
// that say "Removed in" or "has no effect".
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-env-ignored-var')

const project = '.claude/settings.json'
const local = '.claude/settings.local.json'
const managed = 'managed-settings.json'
const dropIn = 'managed-settings.d/10-x.json'
const PROJECT_FILES = [project, local]
const MANAGED_FILES = [managed, dropIn]
const ALL = [...PROJECT_FILES, ...MANAGED_FILES]
const env = (value: object) => JSON.stringify({ env: value })

// "Ignored from every file": the identity variables of the hosting environments and the variables
// that Claude Code reads from the launch environment only.
const EVERY_FILE = [
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
]

// "Project and local settings can't set variables that a checked-out repository shouldn't
// control". A name with a family is one member of it.
const PROJECT_ONLY = [
  'CLAUDE_CONFIG_DIR',
  'CLAUDE_CODE_TMPDIR',
  'HOME',
  'TMPDIR',
  'TMP',
  'TEMP',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
  'XDG_RUNTIME_DIR',
  'SystemRoot',
  'ComSpec',
  'ProgramData',
  'LOCALAPPDATA',
  'PATHEXT',
  'PSModulePath',
  'ProgramFiles',
  'ProgramFiles(x86)',
  'OTEL_LOG_RAW_API_BODIES',
  'ENABLE_BETA_TRACING_DETAILED',
  'BETA_TRACING_ENDPOINT',
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
  'OTEL_EXPORTER_OTLP_ENDPOINT',
  'OTEL_EXPORTER_OTLP_HEADERS',
  'OTEL_EXPORTER_OTLP_PROTOCOL',
  'OTEL_EXPORTER_OTLP_CERTIFICATE',
  'OTEL_EXPORTER_OTLP_CLIENT_KEY',
  'OTEL_EXPORTER_OTLP_INSECURE',
  'OTEL_EXPORTER_OTLP_METRICS_HEADERS',
  'OTEL_EXPORTER_OTLP_LOGS_ENDPOINT',
  'OTEL_EXPORTER_OTLP_TRACES_PROTOCOL',
  'OTEL_EXPORTER_OTLP_METRICS_CLIENT_CERTIFICATE',
  'OTEL_EXPORTER_PROMETHEUS_HOST',
  'OTEL_EXPORTER_PROMETHEUS_PORT',
  'CLAUDE_CODE_PROCESS_WRAPPER',
  'CLAUDE_CODE_SYNC_SKILLS',
  'CLAUDE_CODE_SYNC_PLUGINS',
  'CLAUDE_CODE_PLUGIN_CACHE_DIR',
  'CLAUDE_CODE_PLUGIN_SEED_DIR',
  'CLAUDE_CODE_USER_DIALOG_TIMEOUT_MS',
  'CLAUDE_AFK_TIMEOUT_MS',
  'CLAUDE_AFK_COUNTDOWN_MS',
  'CLAUDE_CODE_DISABLE_ATTACHMENTS',
]

// "Removed ... and now a no-op", with the version of the env vars reference.
const REMOVED: [string, string][] = [
  ['CLAUDE_CODE_CONNECT_TIMEOUT_MS', '2.1.186'],
  ['CLAUDE_CODE_ENABLE_OPUS_4_7_FAST_MODE', '2.1.142'],
  ['CLAUDE_CODE_OPUS_4_6_FAST_MODE_OVERRIDE', '2.1.160'],
  ['CLAUDE_CODE_MAX_SUBAGENTS_PER_SESSION', '2.1.224'],
  ['CLAUDE_SUBAGENT_BG_SHELL_MAX_MS', '2.1.260'],
  ['TASK_MAX_OUTPUT_LENGTH', '2.1.277'],
  // "Accepted for compatibility ... and has no effect". Setting it was required in v2.1.158
  // through v2.1.206.
  ['CLAUDE_CODE_ENABLE_AUTO_MODE', '2.1.207'],
  ['CLAUDE_CODE_AUTO_BACKGROUND_WORKER_CHECKIN_SECONDS', '2.1.283'],
]

// "Only these values still apply from project and local settings, because they turn something
// off: none for the three exporter selectors, and an off value such as 0 for
// OTEL_LOG_USER_PROMPTS, OTEL_LOG_TOOL_CONTENT, and OTEL_LOG_TOOL_DETAILS".
const SELECTORS = ['OTEL_LOGS_EXPORTER', 'OTEL_METRICS_EXPORTER', 'OTEL_TRACES_EXPORTER']
const CONTENT = ['OTEL_LOG_USER_PROMPTS', 'OTEL_LOG_TOOL_CONTENT', 'OTEL_LOG_TOOL_DETAILS']

jsonTester.run('settings-env-ignored-var (valid)', rule, {
  valid: [
    // A variable that a settings file may set.
    ...ALL.map((filename) => ({
      code: env({ API_TIMEOUT_MS: '1200000', DISABLE_AUTO_COMPACT: '1', ANTHROPIC_MODEL: 'opus' }),
      filename,
    })),
    // The variables that are ignored in project and local files only are valid in a managed file.
    ...PROJECT_ONLY.flatMap((name) =>
      MANAGED_FILES.map((filename) => ({ code: env({ [name]: 'x' }), filename })),
    ),
    // `OTEL_LOG_MANAGED_SETTINGS` is "Set to 1" to turn it on and "a value in project or local
    // settings doesn't turn it on". The rule lets an off value pass, which is a choice of the
    // plugin, because the value changes nothing.
    ...['0', 'false', 'No', 'OFF'].flatMap((value) =>
      PROJECT_FILES.map((filename) => ({
        code: env({ OTEL_LOG_MANAGED_SETTINGS: value }),
        filename,
      })),
    ),
    // The telemetry-off values still apply in a project file.
    ...SELECTORS.flatMap((name) =>
      ['none', 'None'].flatMap((value) =>
        PROJECT_FILES.map((filename) => ({ code: env({ [name]: value }), filename })),
      ),
    ),
    ...CONTENT.flatMap((name) =>
      ['0', 'false', 'no', 'off', 'OFF', 'False'].flatMap((value) =>
        PROJECT_FILES.map((filename) => ({ code: env({ [name]: value }), filename })),
      ),
    ),
    // The variables that the docs do not list stay silent in a project file: the resource
    // attributes and the interval, timeout and compression variables.
    ...PROJECT_FILES.map((filename) => ({
      code: env({
        OTEL_RESOURCE_ATTRIBUTES: 'team=a',
        OTEL_METRIC_EXPORT_INTERVAL: '60000',
        OTEL_LOGS_EXPORT_INTERVAL: '5000',
        OTEL_METRICS_EXPORT_TIMEOUT: '30000',
        OTEL_EXPORTER_OTLP_TIMEOUT: '10000',
        OTEL_EXPORTER_OTLP_COMPRESSION: 'gzip',
        OTEL_EXPORTER_OTLP_METRICS_COMPRESSION: 'gzip',
        OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE: 'delta',
      }),
      filename,
    })),
    // Claude Code sets these itself. The docs do not say that it drops a settings value, so the
    // rule makes no report.
    ...ALL.map((filename) => ({
      code: env({
        CLAUDE_CODE_CHILD_SESSION: '1',
        CLAUDE_CODE_SESSION_ID: 'x',
        CLAUDE_CODE_REMOTE_SESSION_ID: 'x',
        CLAUDE_CODE_BRIDGE_SESSION_ID: 'x',
        CLAUDE_EFFORT: 'high',
        CLAUDE_JOB_DIR: '/x',
        CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST: '1',
        CLAUDE_PID: '1',
      }),
      filename,
    })),
    // A near name is another variable. The name has letter case, and a prefix needs its
    // underscore.
    ...ALL.map((filename) => ({
      code: env({
        XDG: 'x',
        MYXDG_HOME: 'x',
        XProgramFiles: 'x',
        MYHOME: 'x',
        home: 'x',
        systemroot: 'x',
        ProgramFilesX: 'x',
        'ProgramFiles(x86': 'x',
        OTEL_EXPORTER_OTLP_ENDPOINT_X: 'x',
        OTEL_EXPORTER_OTLP_HEADERS_X: 'x',
        XOTEL_EXPORTER_OTLP_ENDPOINT: 'x',
        OTEL_EXPORTER_OTLP_FOO: 'x',
        OTEL_EXPORTER_PROMETHEUS_INTERVAL: 'x',
        CLAUDE_CONFIG_DIR_X: 'x',
        CLAUDE_CODE_REMOTE_X: 'x',
        CLAUDE_CODE_CONNECT_TIMEOUT: 'x',
        TASK_MAX_OUTPUT: 'x',
      }),
      filename,
    })),
    // A name that is an `Object` method is no variable that the rule knows.
    ...ALL.map((filename) => ({
      code: '{"env": {"constructor": "x", "toString": "x", "__proto__": "x", "hasOwnProperty": "x"}}',
      filename,
    })),
    // A name outside `env`, and inside a nested value, is no env variable.
    ...ALL.map((filename) => ({
      code: JSON.stringify({ HOME: 'x', CLAUDE_CODE_REMOTE: '1', sandbox: { env: { HOME: 'x' } } }),
      filename,
    })),
    // An `env` that is not an object has no variable.
    ...ALL.flatMap((filename) =>
      ['"x"', '[1]', 'null', '1', 'true', '{}'].map((value) => ({
        code: `{"env": ${value}}`,
        filename,
      })),
    ),
    // A top-level value that is not an object has no `env`.
    ...ALL.flatMap((filename) =>
      ['[1]', '"x"', 'null', '1', 'true'].map((code) => ({ code, filename })),
    ),
    // Claude Code ignores a hidden drop-in.
    {
      code: env({ CLAUDE_CODE_REMOTE: '1', TASK_MAX_OUTPUT_LENGTH: '1' }),
      filename: 'managed-settings.d/.10-x.json',
    },
    {
      code: env({ CLAUDE_CODE_REMOTE: '1' }),
      filename: 'etc/managed-settings.d/.10-x.json',
    },
    // Two keys of one name. The rule reads the last, as `JSON.parse` does.
    {
      code: '{"env": {"OTEL_LOGS_EXPORTER": "otlp", "OTEL_LOGS_EXPORTER": "none"}}',
      filename: project,
    },
    { code: '{"env": {"HOME": "x"}, "env": {"FOO": "x"}}', filename: project },
  ],
  invalid: [],
})

jsonTester.run('settings-env-ignored-var (invalid)', rule, {
  valid: [],
  invalid: [
    // A variable that is ignored from every file reports in each file, on the key.
    ...EVERY_FILE.flatMap((name) =>
      ALL.map((filename) => ({
        code: env({ FOO: 'x', [name]: '1' }),
        filename,
        errors: [
          {
            messageId: 'everyFile' as const,
            data: { name },
            line: 1,
            column: 19,
            endColumn: 19 + name.length + 2,
          },
        ],
      })),
    ),
    // A variable that is ignored in project and local files reports there, and not in a managed
    // file (see the valid cases).
    ...PROJECT_ONLY.flatMap((name) =>
      PROJECT_FILES.map((filename) => ({
        code: env({ FOO: 'x', [name]: '1' }),
        filename,
        errors: [
          {
            messageId: 'projectFiles' as const,
            data: { name },
            line: 1,
            column: 19,
            endColumn: 19 + name.length + 2,
          },
        ],
      })),
    ),
    // A removed variable reports in each file.
    ...REMOVED.flatMap(([name, since]) =>
      ALL.map((filename) => ({
        code: env({ FOO: 'x', [name]: '1' }),
        filename,
        errors: [{ messageId: 'removed' as const, data: { name, since }, line: 1, column: 19 }],
      })),
    ),
    // A drop-in with the name of a project file is a managed file: the project-only variable is
    // valid, and the variable of every file is not.
    ...['managed-settings.d/settings.json', 'managed-settings.d/settings.local.json'].map(
      (filename) => ({
        code: env({ CLAUDE_CODE_REMOTE: '1', HOME: '/x' }),
        filename,
        errors: [{ messageId: 'everyFile' as const, data: { name: 'CLAUDE_CODE_REMOTE' } }],
      }),
    ),
    // A hidden name outside the directory is no drop-in: it is a local file.
    {
      code: env({ HOME: '/x' }),
      filename: '.claude/.settings.local.json',
      errors: [{ messageId: 'projectFiles' as const }],
    },
    // Only the values of the docs apply from a project file. Another value is dropped.
    ...SELECTORS.flatMap((name) =>
      ['otlp', 'console', '', 'none,otlp', '0'].map((value) => ({
        code: env({ [name]: value }),
        filename: project,
        errors: [{ messageId: 'projectFiles' as const, data: { name } }],
      })),
    ),
    ...CONTENT.flatMap((name) =>
      ['1', 'true', '', 'yes', ' 0', '00'].map((value) => ({
        code: env({ [name]: value }),
        filename: local,
        errors: [{ messageId: 'projectFiles' as const, data: { name } }],
      })),
    ),
    // The off value of one variable is no exception for another variable. The docs name an
    // exception for the three content variables and the three selectors only.
    ...[
      ['OTEL_LOG_ASSISTANT_RESPONSES', '0'],
      ['OTEL_LOG_RAW_API_BODIES', '0'],
      ['ENABLE_BETA_TRACING_DETAILED', '0'],
      ['CLAUDE_CODE_ENABLE_TELEMETRY', '0'],
      ['CLAUDE_CODE_ENHANCED_TELEMETRY_BETA', 'false'],
      ['OTEL_LOGS_EXPORTER', 'off'],
      ['OTEL_LOG_USER_PROMPTS', 'none'],
      ['OTEL_EXPORTER_OTLP_ENDPOINT', 'none'],
    ].map(([name, value]) => ({
      code: env({ [name as string]: value }),
      filename: project,
      errors: [{ messageId: 'projectFiles' as const, data: { name } }],
    })),
    // A value that is not a string is not an off value.
    ...[0, false, null].map((value) => ({
      code: env({ OTEL_LOG_USER_PROMPTS: value }),
      filename: project,
      errors: [{ messageId: 'projectFiles' as const }],
    })),
    // The value of a variable ignored from every file does not matter. An off value is no
    // exception there.
    ...['none', '0', ''].map((value) => ({
      code: env({ CLAUDE_CODE_RESTRICTED: value }),
      filename: project,
      errors: [{ messageId: 'everyFile' as const }],
    })),
    // The text of each message.
    {
      code: env({ CLAUDE_CODE_REMOTE: 'true', FOO: 'a' }),
      filename: local,
      errors: [
        {
          message:
            'Claude Code ignores "CLAUDE_CODE_REMOTE" in the env block of every settings file.',
        },
      ],
    },
    {
      code: env({ CLAUDE_CONFIG_DIR: '/x', FOO: 'a' }),
      filename: local,
      errors: [
        {
          message:
            'Claude Code ignores "CLAUDE_CONFIG_DIR" in the env block of a project or local settings file. Set it in your shell, user settings, or managed settings.',
        },
      ],
    },
    {
      code: env({ TASK_MAX_OUTPUT_LENGTH: '1', FOO: 'a' }),
      filename: local,
      errors: [
        {
          message:
            'Claude Code ignores "TASK_MAX_OUTPUT_LENGTH" since v2.1.277. The variable has no effect.',
        },
      ],
    },
    // One report for each variable, in file order.
    {
      code: env({
        FOO: 'x',
        CLAUDE_CODE_REMOTE: '1',
        HOME: '/x',
        CLAUDE_CODE_CONNECT_TIMEOUT_MS: '1',
        OTEL_LOGS_EXPORTER: 'none',
        TMPDIR: '/t',
      }),
      filename: project,
      errors: [
        { messageId: 'everyFile' as const },
        { messageId: 'projectFiles' as const },
        { messageId: 'removed' as const },
        { messageId: 'projectFiles' as const },
      ],
    },
    // Two keys of one name. The rule reads the last.
    {
      code: '{"env": {"OTEL_LOGS_EXPORTER": "none", "OTEL_LOGS_EXPORTER": "otlp"}}',
      filename: project,
      errors: [{ messageId: 'projectFiles' as const, column: 40 }],
    },
    {
      code: '{"env": {"FOO": "x"}, "env": {"HOME": "x"}}',
      filename: project,
      errors: [{ messageId: 'projectFiles' as const, column: 31 }],
    },
  ],
})

// A number in a telemetry variable is two faults: the type, and a value that is no off string.
describe('settings-env-ignored-var and settings-env-value-format on one variable', () => {
  const lint = (code: string) =>
    new Linter().verify(
      code,
      [
        {
          files: ['**/*.json'],
          plugins: { json, claude: plugin },
          language: 'json/json',
          rules: {
            'claude/settings-env-ignored-var': 'error',
            'claude/settings-env-value-format': 'error',
          },
        },
      ],
      { filename: project },
    )

  it('reports a number in an exception variable once for each fault', () => {
    // The report on the key comes before the report on the value.
    expect(lint(env({ OTEL_LOG_USER_PROMPTS: 0 })).map(({ ruleId }) => ruleId)).toEqual([
      'claude/settings-env-ignored-var',
      'claude/settings-env-value-format',
    ])
  })

  it('makes no report on an off value in a project file', () => {
    expect(lint(env({ OTEL_LOG_USER_PROMPTS: '0' }))).toEqual([])
  })
})
