---
type: Reference
description: The ESLint rule claude/settings-env-shadowed, which reports an env variable that other config voids, such as BASH_MAX_OUTPUT_LENGTH beside bashOutputMaxChars, ANTHROPIC_DEFAULT_MODEL beside model or set to haiku, CLAUDE_CODE_SUBAGENT_MODEL set to inherit, and NO_COLOR or FORCE_COLOR.
owner: brianespinosa
created: 2026-10-09
related_issues: [14]
stale_after: 2027-04-09
generated:
  by: claude-code
  at: 2026-10-09T00:00:00Z
---

# `settings-env-shadowed`

Do not set an `env` variable that another setting, or its own value, voids.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

Claude Code reads some `env` variables and does not act on them. The rule reports each such
variable. The rule reads the linted file only, so a key in another file is not seen. A `null` value
removes a key, so the rule takes it as no key. For two keys of one name, the rule reads the last,
as `JSON.parse` does. A hidden file in `managed-settings.d/` gets no report, because Claude Code
ignores it.

| Variable | Voided when | Report on | The docs say |
|----------|-------------|-----------|--------------|
| `BASH_MAX_OUTPUT_LENGTH` | the file also sets `bashOutputMaxChars` | the variable name | "When you set this key, Claude Code ignores the `BASH_MAX_OUTPUT_LENGTH` environment variable."[^bash] |
| `ANTHROPIC_DEFAULT_MODEL` | the file also sets `model` | the variable name | Claude Code starts a new session on the variable's model "only when none of these selects a model", and a `model` value "in any settings file" is one of them.[^default] |
| `ANTHROPIC_DEFAULT_MODEL` | its value is `default`, `inherit`, `opusplan` or `haiku` | the value | "Claude Code ignores the variable in these cases ... You set it to `default`, `inherit`, `opusplan`, or `haiku`"[^default] |
| `CLAUDE_CODE_SUBAGENT_MODEL` | its value is `inherit` | the value | "Setting the variable to `inherit` is the same as leaving it unset."[^subagent] |
| `NO_COLOR`, `FORCE_COLOR` | always | the variable name | "`NO_COLOR` and `FORCE_COLOR` set here reach only subprocesses."[^shell] |

A value of `ANTHROPIC_DEFAULT_MODEL` that is one of the four ignored values gets one report. The
rule does not add the `model` report for it. A variable with an empty string value is not set:
the empty string cancels a value that the shell exports.[^shell] The rule makes no report on it.

### Colors

`NO_COLOR` and `FORCE_COLOR` in `env` change the colors of the processes that Claude Code starts,
for example a Bash command. They do not change the colors of Claude Code. To change those, the docs say to set the variables in your shell before you start `claude`.[^shell]
A team that sets the variable for its subprocesses on purpose can disable the rule for that line.

### What the rule does not check

- The `model` field of an agent under `CLAUDE_CODE_SUBAGENT_MODEL_FORCE`. The docs say that Claude
  Code then ignores the field in a subagent definition.[^force] The rule `agent-model-forced`
  reports that case, and reads the agent file. This rule makes no second report.
- `ANTHROPIC_DEFAULT_MODEL` beside `enforceAvailableModels`, or beside a model that the
  organization excludes. The docs name both as reasons that Claude Code ignores the variable.[^default]
  The first needs a key in the same file. The second needs a file that is not in the repository.
- A `model` or a `bashOutputMaxChars` in another file. A user file can set either one, and Claude
  Code then voids the variable in the same way. The rule does not see it.
- The value of a variable. `settings-env-value-format` and `settings-model-value` are for it.

Fail, in `.claude/settings.json`:

```json
{
  "model": "opus",
  "bashOutputMaxChars": 100000,
  "env": {
    "ANTHROPIC_DEFAULT_MODEL": "sonnet",
    "BASH_MAX_OUTPUT_LENGTH": "50000",
    "CLAUDE_CODE_SUBAGENT_MODEL": "inherit",
    "NO_COLOR": "1"
  }
}
```

Pass:

```json
{
  "bashOutputMaxChars": 100000,
  "env": {
    "ANTHROPIC_DEFAULT_MODEL": "sonnet",
    "CLAUDE_CODE_SUBAGENT_MODEL": "haiku"
  }
}
```

## Sources

[^bash]: [All settings: bashOutputMaxChars](https://code.claude.com/docs/en/settings-reference#bashoutputmaxchars)
[^default]: [Model configuration: Set a default model for new sessions](https://code.claude.com/docs/en/model-config#set-a-default-model-for-new-sessions)
[^subagent]: [Create custom subagents: Choose a model](https://code.claude.com/docs/en/sub-agents#choose-a-model)
[^force]: [Create custom subagents: Run every subagent on one model](https://code.claude.com/docs/en/sub-agents#run-every-subagent-on-one-model)
[^shell]: [All settings: How env values interact with your shell](https://code.claude.com/docs/en/settings-reference#how-env-values-interact-with-your-shell)
