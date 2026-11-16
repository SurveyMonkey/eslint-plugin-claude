---
type: Reference
description: The ESLint rule claude/settings-model-pin-version, which reports a model alias in the shared project settings file that moves to a newer model over time, and an availableModels entry without the provider prefix when the same file selects Amazon Bedrock. It is off in recommended.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# claude/settings-model-pin-version

📝 Pin the model of the shared settings file to a version.

⚠️ This rule _warns_ in the 🔒 `strict` config.

<!-- end auto-generated rule header -->

| Category | Files                                                                                  |
| -------- | -------------------------------------------------------------------------------------- |
| practice | `**/.claude/settings.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

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
  `opusplan` needs the variables of Opus and Sonnet. `best` is the model of `opus`, so it needs
  the Opus variable only.
- The value is a full model ID, a provider ID, or any other text that is not an alias.

The part reads only the shared project file. A managed file holds a policy, and the local file
belongs to one user.

### An allowlist entry without the provider prefix

The allowlist compares each entry with the model ID in provider form. The page says that Claude
Code does not strip a provider prefix such as `us.anthropic.`. To allow a specific model, list its
full ID in provider form.[^pin] On Amazon Bedrock the form has that prefix.

The rule reports an `availableModels` entry that is an Anthropic model ID, such as
`claude-opus-4-8`. It does so only when the same file turns on `CLAUDE_CODE_USE_BEDROCK` in `env`.
The report is on the entry. The rule makes no report in these cases:

- The entry is an alias, or a provider-form ID such as `us.anthropic.claude-opus-4-8`.
- The entry is a key of `modelOverrides` in the same file. The page says that Claude Code compares
  the allowlist with the Anthropic ID of an overridden model.[^overrides]
- The file does not select Amazon Bedrock. See the list below.

The check covers Amazon Bedrock only. The page of each provider shows the form of a model ID. No
page of the other four providers shows a provider prefix:

- **Amazon Bedrock.** The startup checks "compare each entry with the inference profile ID they
  would send, including its region prefix".[^bedrock-allowlist] The pin example uses
  `us.anthropic.claude-opus-4-8`.[^bedrock-pin]
- **Google Cloud's Agent Platform.** The checks "compare each entry with the model ID they would
  send to Agent Platform". The example lists `claude-opus-4-8` and
  `claude-sonnet-4-5@20250929`.[^vertex-allowlist] The `@` date is a suffix, not a prefix.
- **Microsoft Foundry.** The pin example uses `claude-opus-4-8`.[^foundry-pin]
- **Claude Platform on AWS.** The pin example uses `claude-opus-4-8`.[^aws-pin]
- **Claude Models on Google Cloud (Anthropic managed).** The pin example uses
  `claude-opus-5-5`.[^gcp-pin]

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

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/settings-model-pin-version': 'warn'
```

## Sources

[^aliases]: [Model configuration: Model aliases](https://code.claude.com/docs/en/model-config#model-aliases)
[^pin]: [Model configuration: Pin models for third-party deployments](https://code.claude.com/docs/en/model-config#pin-models-for-third-party-deployments)
[^bedrock-allowlist]: [Amazon Bedrock: When your organization enforces a model allowlist](https://code.claude.com/docs/en/amazon-bedrock#when-your-organization-enforces-a-model-allowlist)
[^bedrock-pin]: [Amazon Bedrock: 4. Pin model versions](https://code.claude.com/docs/en/amazon-bedrock#4-pin-model-versions)
[^vertex-allowlist]: [Google Cloud's Agent Platform: When your organization enforces a model allowlist](https://code.claude.com/docs/en/google-vertex-ai#when-your-organization-enforces-a-model-allowlist)
[^foundry-pin]: [Microsoft Foundry: 4. Pin model versions](https://code.claude.com/docs/en/microsoft-foundry#4-pin-model-versions)
[^aws-pin]: [Claude Platform on AWS: 3. Pin model versions](https://code.claude.com/docs/en/claude-platform-on-aws#3-pin-model-versions)
[^gcp-pin]: [Claude Models on Google Cloud (Anthropic managed): Pin model versions](https://code.claude.com/docs/en/claude-models-on-google-cloud-anthropic-managed#pin-model-versions)
[^overrides]: [Model configuration: Override model IDs per version](https://code.claude.com/docs/en/model-config#override-model-ids-per-version)
