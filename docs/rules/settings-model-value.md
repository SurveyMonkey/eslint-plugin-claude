---
type: Reference
description: The ESLint rule claude/settings-model-value, which reports a model, fallbackModel, availableModels, advisorModel, ANTHROPIC_MODEL or CLAUDE_CODE_SUBAGENT_MODEL value that is not an alias, a claude- ID or a provider form, and an alias in an ANTHROPIC_DEFAULT_*_MODEL variable.
owner: brianespinosa
created: 2026-10-09
related_issues: [14]
stale_after: 2027-04-09
generated:
  by: claude-code
  at: 2026-10-09T00:00:00Z
---

# `settings-model-value`

Set each model value to an alias or a model ID in a known form.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

Claude Code does not check a model value at startup. A mistyped value in the `model` setting
produces an error on the first request.[^model] The rule finds the typo in the file.

The aliases and the ID forms are in `src/data/models.ts`, with the Claude Code version of the
last review. A model alias is `default`, `best`, `fable`, `sonnet`, `opus`, `haiku` or
`opusplan`.[^aliases] The rule accepts the suffix `[1m]` on every alias except `default`. The table lists it for `sonnet`
and `opus`.[^aliases] A model ID starts with
`claude-`, as in `claude-opus-5-5`.[^recognized] A gateway or a provider can accept other forms,
so this is a check of the form. The rule reports on the value.

### Values that the rule checks

| Value | Accepted | Docs |
|-------|----------|------|
| `model` | An alias or a `claude-` ID | "a model alias or full model ID"[^setting] |
| `fallbackModel`, each entry | An alias or a `claude-` ID | "array of model aliases or IDs; `"default"` expands to the default model"[^fallback] |
| `availableModels`, each entry | An alias or a `claude-` ID | "array of model aliases or IDs"[^available] |
| `env.ANTHROPIC_MODEL`, `env.CLAUDE_CODE_SUBAGENT_MODEL` | An alias or a `claude-` ID | `ANTHROPIC_MODEL=<alias\|name>`[^model]. For the second variable: "Accepts an alias such as `haiku` or a full model name"[^variables] |
| `advisorModel` | `fable`, `opus`, `sonnet`, or a `claude-` ID | "one of the aliases `"fable"`, `"opus"`, or `"sonnet"` ... or a full model ID"[^advisor] |
| `env.ANTHROPIC_DEFAULT_OPUS_MODEL`, `_SONNET_`, `_HAIKU_`, `_FABLE_` | Any value that is not an alias | "Each value must be a full model name, or the equivalent identifier for your API provider"[^variables] |

The empty string in an `env` variable is valid. It cancels a value that the shell exports.[^shell]

For an `ANTHROPIC_DEFAULT_*_MODEL` variable, the rule reports an alias only, such as `opus` or
`default`. The docs give a Bedrock ID, an ARN and a Foundry deployment name as valid values. So the rule does not require the `claude-` prefix there.[^variables]

### Options

`providerIdPatterns` is a list of regular expression sources. A value that matches one passes the
check of `model`, `fallbackModel`, `availableModels`, `advisorModel`, `env.ANTHROPIC_MODEL` and
`env.CLAUDE_CODE_SUBAGENT_MODEL`. The default is an empty list. A pattern is not empty.

A provider form passes without the option. One form is an ARN that starts with `arn:`. Another is
an ID that starts with `anthropic.`. The last is an ID that embeds a `claude-` name, such as
`us.anthropic.claude-opus-4-8` or `my-gateway/claude-opus-5-5`.[^available-forms] The docs say that
Claude Code skips validation for the custom model option. So a value that equals
`env.ANTHROPIC_CUSTOM_MODEL_OPTION` in the same file passes too.

The docs name two more forms of a model name. On Microsoft Foundry, it is a deployment name. On
Google Cloud Agent Platform, it is a version name. These names have no common form. The rule
cannot know the provider of a team. A team that uses one lists its forms:

```json
{
  "rules": {
    "claude/settings-model-value": [
      "error",
      { "providerIdPatterns": ["^us\\.anthropic\\.claude-", "^arn:aws:bedrock:"] }
    ]
  }
}
```

A pattern that is not a regular expression stops the run with an error. The option does not
change what the rule takes as an alias.

### What the rule does not check

- `ANTHROPIC_DEFAULT_MODEL`. `settings-env-shadowed` owns it.
- `CLAUDE_CODE_SUBAGENT_MODEL: "inherit"`. The docs say that this value is the same as an unset
  variable. `settings-env-shadowed` reports it, so this rule makes no second report.[^subagent]
- Whether a model exists. The rule checks the form of a value, not the model list of an account.
- A value of a wrong type, and a key that is not a list. `settings-schema` is for these.
- The model of an agent, a skill or a hook.
- A hidden file in `managed-settings.d/`. Claude Code ignores it.

When a file has two keys of one name, the rule reads the last, as `JSON.parse` does. A `null`
value removes a key, so the rule makes no report on it.

Fail, in `.claude/settings.json`:

```json
{
  "model": "sonet",
  "fallbackModel": ["sonnet", "gpt-5"],
  "advisorModel": "haiku",
  "env": { "ANTHROPIC_DEFAULT_OPUS_MODEL": "opus" }
}
```

Pass:

```json
{
  "model": "sonnet",
  "fallbackModel": ["sonnet", "claude-haiku-4-5"],
  "advisorModel": "opus",
  "env": { "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-8" }
}
```

## Sources

[^model]: [Model configuration: Setting your model](https://code.claude.com/docs/en/model-config#setting-your-model)
[^aliases]: [Model configuration: Model aliases](https://code.claude.com/docs/en/model-config#model-aliases)
[^recognized]: [Error reference: Model is not a recognized model id](https://code.claude.com/docs/en/errors#model-is-not-a-recognized-model-id)
[^setting]: [All settings: model](https://code.claude.com/docs/en/settings-reference#model)
[^fallback]: [All settings: fallbackModel](https://code.claude.com/docs/en/settings-reference#fallbackmodel)
[^available]: [All settings: availableModels](https://code.claude.com/docs/en/settings-reference#availablemodels)
[^advisor]: [All settings: advisorModel](https://code.claude.com/docs/en/settings-reference#advisormodel)
[^variables]: [Model configuration: Environment variables](https://code.claude.com/docs/en/model-config#environment-variables)
[^available-forms]: [Model configuration: Available models](https://code.claude.com/docs/en/model-config#available-models)
[^shell]: [All settings: How env values interact with your shell](https://code.claude.com/docs/en/settings-reference#how-env-values-interact-with-your-shell)
[^subagent]: [Create custom subagents: Choose a model](https://code.claude.com/docs/en/sub-agents#choose-a-model)
