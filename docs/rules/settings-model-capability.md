---
type: Reference
description: The ESLint rule claude/settings-model-capability, which reports a [1m] suffix on a model with no 1M context window, and a thinking setting that Claude Code ignores on a model that always thinks. It is off in recommended.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-model-capability`

Do not set a model option that the model of the file does not support.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule is `off` in `recommended`. It is a heuristic. `strict` turns it on at `warn`. The model
versions are in `src/data/models.ts`.

## Rule details

The rule reads the model of the same file. It reads `ANTHROPIC_MODEL` in `env` first, and then
`model`. The default model of an account is not in the file, so a file with no model gets no report
of the thinking part.

### The `[1m]` suffix

The suffix selects the 1M context window of a model that reaches it by the suffix. Fable, Sonnet 5
and later, Haiku 5.5, Opus 4.6 and later, and Sonnet 4.6 have a 1M window.[^context] An older model
has none, and the suffix gives nothing.

The rule reports a `[1m]` suffix on a full model ID of an older model, such as
`claude-sonnet-4-5[1m]` or `claude-haiku-4-5[1m]`. It reads these places: `model`, `fallbackModel`,
each `availableModels` entry, `ANTHROPIC_MODEL`, `CLAUDE_CODE_SUBAGENT_MODEL` and the four
`ANTHROPIC_DEFAULT_*_MODEL` variables. It makes no report for an alias, because an alias resolves
to another model on another provider.

### Thinking that cannot be turned off

Thinking cannot be turned off on Opus 5.5, Sonnet 5.5, Haiku 5.5 and the Fable models. A saved
`alwaysThinkingEnabled: false` or `MAX_THINKING_TOKENS=0` has no effect on them.[^thinking] The
rule reports these on such a model: `alwaysThinkingEnabled` set to `false`, and `MAX_THINKING_TOKENS`
set to `0` in `env`.[^vars]

Fable, Sonnet 5 and later, Haiku 5.5, and Opus 4.7 and later always use adaptive reasoning. The
variable `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING` does not apply to them.[^adaptive] The rule reports
that variable, when it is on, on such a model.

### Which model the rule judges

- A full model ID, or a provider ID that has a `claude-` name in it.
- An alias that the file pins in `env`. The rule judges the pinned model, if it can read the ID.
- An alias that is not pinned: only when the file selects no provider. The rule then uses the model
  that the alias has on the Anthropic API.[^aliases] `best`, `opusplan` and `default` are not judged.

### What the rule does not check

- A model that another file sets.
- A model from the account default, a flag or the shell.
- A model that the rule cannot read, such as an ARN.
- A value of the wrong type. `settings-schema` reports it.

A hidden drop-in gets no report, as Claude Code ignores it.

Fail:

```json
{
  "model": "claude-opus-5-5",
  "alwaysThinkingEnabled": false
}
```

Pass:

```json
{
  "model": "claude-opus-4-6",
  "alwaysThinkingEnabled": false
}
```

## Sources

[^context]: [Model configuration: Extended context](https://code.claude.com/docs/en/model-config#extended-context)
[^thinking]: [Model configuration: Extended thinking](https://code.claude.com/docs/en/model-config#extended-thinking)
[^adaptive]: [Model configuration: Adaptive reasoning and fixed thinking budgets](https://code.claude.com/docs/en/model-config#adaptive-reasoning-and-fixed-thinking-budgets)
[^aliases]: [Model configuration: Model aliases](https://code.claude.com/docs/en/model-config#model-aliases)
[^vars]: [Environment variables: Variables](https://code.claude.com/docs/en/env-vars#variables)
