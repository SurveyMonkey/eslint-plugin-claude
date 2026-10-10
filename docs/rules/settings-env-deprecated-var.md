---
type: Reference
description: The ESLint rule claude/settings-env-deprecated-var, which reports an env variable that Claude Code deprecates or keeps as a legacy name, such as ANTHROPIC_SMALL_FAST_MODEL, ENABLE_PROMPT_CACHING_1H_BEDROCK, DISABLE_BUG_COMMAND, SLASH_COMMAND_TOOL_CHAR_BUDGET, and CLAUDE_CODE_ENABLE_TASKS set to 0.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-env-deprecated-var`

Do not set an `env` variable that Claude Code deprecates.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | deprecated | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

Claude Code still reads each variable in this table. The env vars reference marks two of them as
deprecated, and calls two of them an older or legacy name.[^vars] The names are in
`src/data/settings-env.ts`.

| Variable | What the docs say |
|----------|-------------------|
| `ANTHROPIC_SMALL_FAST_MODEL` | Deprecated. Use `ANTHROPIC_DEFAULT_HAIKU_MODEL`.[^vars][^model] |
| `ENABLE_PROMPT_CACHING_1H_BEDROCK` | Deprecated. Use `ENABLE_PROMPT_CACHING_1H`.[^vars] |
| `DISABLE_BUG_COMMAND` | An older name of `DISABLE_FEEDBACK_COMMAND`.[^vars] |
| `SLASH_COMMAND_TOOL_CHAR_BUDGET` | A legacy name that Claude Code keeps for backward compatibility. The docs name no replacement.[^vars] |
| `CLAUDE_CODE_ENABLE_TASKS` set to `0` | Selects the legacy `TodoWrite` tool in place of the Task tools.[^vars] |

The report is on the variable name. The message names the replacement when the docs give one.
Each variable gets one report. When a file has two keys of one name, the rule reads the last, as
`JSON.parse` does.

### What the rule does not check

- A value of `""`. It cancels a shell value.[^precedence]
- A value that is not a string. `settings-env-value-format` reports it.
- `CLAUDE_CODE_ENABLE_TASKS` with a value other than `0`. The docs name the value `0` only.
- `ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION`. It is a region variable, and the docs do not
  deprecate it.
- A variable that Claude Code removed or ignores. `settings-env-ignored-var` reports those, so
  each fault gets one report. No name in this rule is in its lists.
- A hidden file in `managed-settings.d/`. Claude Code ignores it.
- A user settings file, or a file passed with `--settings`. They are not in a repository.

Fail:

```json
{
  "env": {
    "ANTHROPIC_SMALL_FAST_MODEL": "claude-haiku-4-5",
    "CLAUDE_CODE_ENABLE_TASKS": "0"
  }
}
```

Pass:

```json
{
  "env": {
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-haiku-4-5"
  }
}
```

## Sources

[^vars]: [Environment variables: Variables](https://code.claude.com/docs/en/env-vars#variables)
[^model]: [Model configuration: Environment variables](https://code.claude.com/docs/en/model-config#environment-variables)
[^precedence]: [Environment variables: Precedence](https://code.claude.com/docs/en/env-vars#precedence)
