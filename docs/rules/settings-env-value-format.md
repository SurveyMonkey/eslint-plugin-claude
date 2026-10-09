---
type: Reference
description: The ESLint rule claude/settings-env-value-format, which reports an env block that is not an object, a variable value that is not a string, and a known variable whose value breaks the form that the Claude Code docs give it, from the forms in src/data/settings-env.ts.
owner: brianespinosa
created: 2026-10-08
related_issues: [14]
stale_after: 2027-04-08
generated:
  by: claude-code
  at: 2026-10-08T00:00:00Z
---

# `settings-env-value-format`

Write `env` as an object of string values, and give a known variable a value in its form.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

The `env` setting has the type "object mapping variable names to string values".[^env] Claude Code
copies each value into its environment as written.[^files] The rule reports three faults:

- `env` is not an object: a string, an array, a number, a Boolean or `null`. The report is on
  the value of `env`.
- A variable has a value that is not a string: `null`, a number, a Boolean, an object or an
  array. The report is on the value.
- A known variable has a string value that breaks its form. The report is on the value.

A value of `""` is valid for each variable. It cancels a variable that the shell exports.[^shell]

### Forms

The forms are in `src/data/settings-env.ts`, with the Claude Code version of the last review.
A variable that is not in the table has no form, and any string is valid.

| Variable | The value must be |
|----------|-------------------|
| `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`, `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`, `CLAUDE_CODE_WEBFETCH_CACHE_TTL_MS` | A positive whole number in plain digits. Claude Code ignores any other spelling[^vars] |
| `CLAUDE_CODE_AUTO_COMPACT_WINDOW` | A plain integer from 100000 to 1000000. A value such as `500k` reads as `500`[^vars] |
| `BASH_MAX_OUTPUT_LENGTH` | At most 150000, the maximum[^vars] |
| `CLAUDE_CODE_TOOL_MEMORY_LIMIT` | A size in plain digits with an optional `K`, `M`, `G` or `T` suffix, or `0`, `off`, `false`, `no`, `none`[^memory] |
| `CLAUDE_CODE_TOOL_MEMORY_CGROUP_EXCLUDE` | `none`, `all-new`, or a comma-separated list of kind names such as `mcp`, `lsp` or `hooks`. Claude Code ignores a name that it does not know, so the rule checks the shape of each name only[^memory] |
| `ENABLE_TOOL_SEARCH` | `auto`, `auto:N` with N from 0 to 100, or a Boolean word: `1`, `true`, `yes`, `on`, `0`, `false`, `no` or `off`, in any casing[^search][^vars] |
| `MCP_SDK_GENERATION` | `v1` or `v2`[^vars] |
| `MCP_PROTOCOL_NEGOTIATION` | `auto` or `legacy`[^vars] |
| `CLAUDE_CODE_PROMPT_CACHE_TTL`, `CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL` | `5m` or `1h`, the only values that Claude Code accepts[^vars] |
| `CLAUDE_CODE_EFFORT_LEVEL` | `low`, `medium`, `high`, `xhigh`, `max` or `auto`. It does not accept `ultracode`[^vars][^effort] |
| `CLAUDE_CODE_SHELL` | A path to a `bash` or `zsh` binary. Other shells are not supported[^vars] |
| `ANTHROPIC_DEFAULT_*_MODEL_SUPPORTED_CAPABILITIES`, `ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES` | A comma-separated list of `effort`, `xhigh_effort`, `max_effort`, `thinking`, `adaptive_thinking`, `interleaved_thinking`[^capabilities] |

The comparison of a value is exact. The rule also accepts a few spellings that the docs do not
state. A list entry may have spaces around it. The size suffix and the words of the memory limit
have any letter case. A path has `\` or `/` between its parts.

### What the rule does not check

- A variable that the docs set to `0` or `1` without a rule for other spellings:
  `CLAUDE_CODE_FORK_SUBAGENT` and `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`.
- A value for `BASH_MAX_OUTPUT_LENGTH` that is not plain digits. The docs give the maximum only.
- Whether the variable can be set in this file. `settings-env-ignored-var` reports a variable
  that settings cannot set.
- A hidden file in `managed-settings.d/`. Claude Code ignores it.

When a file has two keys of one name, the rule reads the last, as `JSON.parse` does.

Fail:

```json
{
  "env": {
    "ENABLE_TOOL_SEARCH": "maybe",
    "CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS": 5,
    "BASH_MAX_OUTPUT_LENGTH": "200000"
  }
}
```

Pass:

```json
{
  "env": {
    "ENABLE_TOOL_SEARCH": "auto:5",
    "CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS": "5",
    "BASH_MAX_OUTPUT_LENGTH": "100000",
    "CLAUDE_CODE_USE_VERTEX": ""
  }
}
```

## Sources

[^env]: [All settings: env](https://code.claude.com/docs/en/settings-reference#env)
[^shell]: [All settings: How env values interact with your shell](https://code.claude.com/docs/en/settings-reference#how-env-values-interact-with-your-shell)
[^files]: [Environment variables: In settings files](https://code.claude.com/docs/en/env-vars#in-settings-files)
[^vars]: [Environment variables: Variables](https://code.claude.com/docs/en/env-vars#variables)
[^memory]: [Tools reference: Memory limit on Linux and WSL](https://code.claude.com/docs/en/tools-reference#memory-limit-on-linux-and-wsl)
[^search]: [Connect Claude Code to tools via MCP: Configure tool search](https://code.claude.com/docs/en/mcp#configure-tool-search)
[^effort]: [Model configuration: Adjust effort level](https://code.claude.com/docs/en/model-config#adjust-effort-level)
[^capabilities]: [Model configuration: Customize pinned model display and capabilities](https://code.claude.com/docs/en/model-config#customize-pinned-model-display-and-capabilities)
