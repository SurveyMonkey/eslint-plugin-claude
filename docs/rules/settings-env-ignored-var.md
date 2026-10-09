---
type: Reference
description: The ESLint rule claude/settings-env-ignored-var, which reports an env variable that Claude Code ignores in a settings file, such as CLAUDE_CONFIG_DIR in a project file, CLAUDE_CODE_REMOTE in any file, or a removed variable, from the lists in src/data/settings-env.ts.
owner: brianespinosa
created: 2026-10-08
related_issues: [14]
stale_after: 2027-04-08
generated:
  by: claude-code
  at: 2026-10-08T00:00:00Z
---

# `settings-env-ignored-var`

Set an `env` variable only in a file where Claude Code reads it.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

Most variables of the env vars reference can go in `env`. Some cannot.[^ignored] Claude Code
drops a project or local value of many of them, and logs a warning that `claude --debug`
shows.[^ignored] The rule reports a variable in `env`
in three cases. The report is on the variable name. The lists are in `src/data/settings-env.ts`,
with the Claude Code version of the last review.

### Ignored in every settings file

Claude Code ignores these variables in the `env` block of any settings file:[^ignored]

- The identity variables that host platforms own: `CLAUDE_CODE_REMOTE` and
  `CLAUDE_CODE_ACCOUNT_UUID`.
- `CLAUDE_CODE_MESSAGING_SOCKET` and `CLAUDE_CODE_MESSAGING_TOKEN`, which Claude Code exports
  itself.
- The variables that Claude Code reads from the launch environment only:
  `CLAUDE_CODE_PROJECT_DIR_NAME`, `CLAUDE_CODE_RESTRICTED`,
  `CLAUDE_CODE_DISABLE_POWERSHELL_CMD_RM_DENY`, `CLAUDE_CODE_DISABLE_DANGEROUS_RM_TIMEOUT`,
  `CLAUDE_CODE_DISABLE_SUBSTITUTION_RM_PROMPT` and `CLAUDE_CODE_DISABLE_INLINE_SHELL_RM_PROMPT`.
- `CLAUDE_CODE_DISABLE_ADMIN_ENV_UNION`. Claude Code ignores a copy in a settings `env` block.[^vars]

### Ignored in project and local files

A repository must not control some variables. Claude Code ignores them in
`.claude/settings.json` and `.claude/settings.local.json`. A user, managed or `--settings` file
can set them, so the rule makes no report in a managed file.[^ignored]

- Where Claude Code stores files: `CLAUDE_CONFIG_DIR`, `CLAUDE_CODE_TMPDIR`, `HOME`, `TMPDIR`,
  `TMP`, `TEMP`, and each `XDG_*` variable.
- Windows variables: `SystemRoot`, `ComSpec`, `ProgramData`, `LOCALAPPDATA`, `PATHEXT`,
  `PSModulePath`, `ProgramFiles` and `ProgramFiles(x86)`.
- Variables that export session content: `OTEL_LOG_RAW_API_BODIES`,
  `ENABLE_BETA_TRACING_DETAILED` and `BETA_TRACING_ENDPOINT`.
- The OpenTelemetry variables: `CLAUDE_CODE_ENABLE_TELEMETRY`,
  `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA`, `ENABLE_ENHANCED_TELEMETRY_BETA`, the exporter
  selectors `OTEL_LOGS_EXPORTER`, `OTEL_METRICS_EXPORTER` and `OTEL_TRACES_EXPORTER`, the content
  variables `OTEL_LOG_USER_PROMPTS`, `OTEL_LOG_ASSISTANT_RESPONSES`, `OTEL_LOG_TOOL_CONTENT` and
  `OTEL_LOG_TOOL_DETAILS`, each `OTEL_EXPORTER_OTLP_*` variable that ends in `_ENDPOINT`,
  `_HEADERS`, `_PROTOCOL`, `_CERTIFICATE`, `_CLIENT_KEY` or `_INSECURE`, and
  `OTEL_EXPORTER_PROMETHEUS_HOST` and `OTEL_EXPORTER_PROMETHEUS_PORT`.
- `OTEL_LOG_MANAGED_SETTINGS`. A value in project or local settings does not turn it on.[^vars]
- Variables that change how Claude Code starts or syncs: `CLAUDE_CODE_PROCESS_WRAPPER`,
  `CLAUDE_CODE_SYNC_SKILLS`, `CLAUDE_CODE_SYNC_PLUGINS`, `CLAUDE_CODE_PLUGIN_CACHE_DIR` and
  `CLAUDE_CODE_PLUGIN_SEED_DIR`.
- The dialog timers `CLAUDE_CODE_USER_DIALOG_TIMEOUT_MS`, `CLAUDE_AFK_TIMEOUT_MS` and
  `CLAUDE_AFK_COUNTDOWN_MS`, and `CLAUDE_CODE_DISABLE_ATTACHMENTS`.

A few values that turn telemetry off still apply from a project or local file. The rule makes
no report on them: `none` for the three exporter selectors, and an off value such as `0` for
`OTEL_LOG_USER_PROMPTS`, `OTEL_LOG_TOOL_CONTENT` and `OTEL_LOG_TOOL_DETAILS`.[^ignored] The
rule reads `0`, `false`, `no` and `off`, in any letter case, as off values. The plugin
gives `OTEL_LOG_MANAGED_SETTINGS` the same exception. The docs name none, and an off value
changes nothing. The other OpenTelemetry variables get a report
for each value, and so does a value that is not a string.

### Removed variables

These variables have no effect. Claude Code removed them, or accepts them for compatibility:[^vars]

| Variable | No effect since |
|----------|-----------------|
| `CLAUDE_CODE_ENABLE_OPUS_4_7_FAST_MODE` | v2.1.142 |
| `CLAUDE_CODE_OPUS_4_6_FAST_MODE_OVERRIDE` | v2.1.160 |
| `CLAUDE_CODE_CONNECT_TIMEOUT_MS` | v2.1.186 |
| `CLAUDE_CODE_ENABLE_AUTO_MODE` | v2.1.207. It was required in v2.1.158 through v2.1.206 |
| `CLAUDE_CODE_MAX_SUBAGENTS_PER_SESSION` | v2.1.224 |
| `CLAUDE_SUBAGENT_BG_SHELL_MAX_MS` | v2.1.260 |
| `TASK_MAX_OUTPUT_LENGTH` | v2.1.277 |
| `CLAUDE_CODE_AUTO_BACKGROUND_WORKER_CHECKIN_SECONDS` | v2.1.283 |

The rule reports a removed variable in each file.

### What the rule does not check

- A variable that Claude Code sets itself, such as `CLAUDE_CODE_CHILD_SESSION`,
  `CLAUDE_CODE_SESSION_ID`, `CLAUDE_CODE_REMOTE_SESSION_ID`, `CLAUDE_CODE_BRIDGE_SESSION_ID`,
  `CLAUDE_EFFORT`, `CLAUDE_JOB_DIR` and `CLAUDE_PID`. The env vars reference says how Claude
  Code sets them. It does not say that Claude Code drops a settings value.[^vars]
- `CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST`. A host platform sets it. The env vars reference does
  not say that Claude Code drops a settings value.[^vars]
- `OTEL_RESOURCE_ATTRIBUTES`, and the interval, timeout and compression variables of the
  OpenTelemetry export. The settings reference does not list them.
- A hidden file in `managed-settings.d/`. Claude Code ignores it.
- A user settings file, or a file passed with `--settings`.

When a file has two keys of one name, the rule reads the last, as `JSON.parse` does.

Fail, in `.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CONFIG_DIR": "/home/you/.claude-work",
    "OTEL_LOGS_EXPORTER": "otlp",
    "TASK_MAX_OUTPUT_LENGTH": "40000"
  }
}
```

Pass, in `.claude/settings.json`:

```json
{
  "env": {
    "OTEL_LOGS_EXPORTER": "none",
    "OTEL_METRIC_EXPORT_INTERVAL": "60000"
  }
}
```

## Sources

[^ignored]: [All settings: Variables Claude Code ignores in env](https://code.claude.com/docs/en/settings-reference#variables-claude-code-ignores-in-env)
[^vars]: [Environment variables: Variables](https://code.claude.com/docs/en/env-vars#variables)
