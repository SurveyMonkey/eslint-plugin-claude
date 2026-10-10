---
type: Reference
description: The ESLint rule claude/settings-model-pin-version, which reports a model alias in the shared project settings file that moves to a newer model over time, and an availableModels entry without the provider prefix when the same file selects Amazon Bedrock. It is off in recommended.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-model-pin-version`

Pin the model of the shared settings file to a version.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/.claude/settings.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule is `off` in `recommended`. It is a heuristic. A team can want an alias, for example to
follow the newest model. `strict` turns it on at `warn`.

## Rule details

The rule has two parts.

### An alias as the model

Aliases point to the recommended version for the provider, and they update over time.[^aliases] A
`model` that is an alias moves to a newer model with a Claude Code release. Every user of the
repository then runs a different model than the one that the team tested. The page names two ways to
pin a version: a full model name, or an `ANTHROPIC_DEFAULT_*_MODEL` variable.[^aliases]

The rule reports the `model` value of `.claude/settings.json` when it is an alias. The aliases are
`opus`, `sonnet`, `haiku`, `fable`, `best` and `opusplan`, with or without the `[1m]` suffix. The
value `default` is not an alias.[^aliases] The rule makes no report in these cases:

- The same file pins the alias in `env`. `opus` needs `ANTHROPIC_DEFAULT_OPUS_MODEL` with a value.
  `opusplan` needs the variables of Opus and Sonnet. `best` needs the variables of Fable and Opus.
- The value is a full model ID, a provider ID, or any other text that is not an alias.

The part reads only the shared project file. A managed file holds a policy, and the local file
belongs to one user.

### An allowlist entry without the provider prefix

The allowlist compares each entry with the provider-form model ID. The page says that provider
prefixes such as `us.anthropic.` are not stripped. To allow a specific model, list its full
provider-form ID.[^pin] On Amazon Bedrock the form has that prefix.

The rule reports an `availableModels` entry that is an Anthropic model ID, such as
`claude-opus-4-8`, when the same file turns on `CLAUDE_CODE_USE_BEDROCK` in `env`. The report is on
the entry. The rule makes no report in these cases:

- The entry is an alias, or a provider-form ID such as `us.anthropic.claude-opus-4-8`.
- The entry is a key of `modelOverrides` in the same file. The page says that Claude Code compares
  the allowlist with the Anthropic ID of an overridden model.[^overrides]
- The file does not select Amazon Bedrock. The other providers use the Anthropic ID.[^pin]

The part reads the shared project file and the managed files. A hidden drop-in gets no report, as
Claude Code ignores it.

### What the rule does not check

- A model alias in `ANTHROPIC_MODEL`, `fallbackModel` or `availableModels`.
- A provider variable or a pin in another file of the same source. The rule reads one file.
- A value that is not a string. `settings-schema` reports it.
- Whether a model value is valid. `settings-model-value` reports that.

Fail:

```json
{
  "model": "opus"
}
```

Pass:

```json
{
  "model": "claude-opus-5-5"
}
```

## Sources

[^aliases]: [Model configuration: Model aliases](https://code.claude.com/docs/en/model-config#model-aliases)
[^pin]: [Model configuration: Pin models for third-party deployments](https://code.claude.com/docs/en/model-config#pin-models-for-third-party-deployments)
[^overrides]: [Model configuration: Override model IDs per version](https://code.claude.com/docs/en/model-config#override-model-ids-per-version)
