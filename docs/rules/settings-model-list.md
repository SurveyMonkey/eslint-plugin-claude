---
type: Reference
description: The ESLint rule claude/settings-model-list, which reports a fallbackModel chain of more than three distinct models, an empty availableModels list that blocks a named model, an enforceAvailableModels key with no list, a family alias that a same-family ID narrows, an ignored deniedModels entry, a modelOverrides key that is no Anthropic ID, and a custom model option that availableModels omits.
owner: brianespinosa
created: 2026-10-09
related_issues: [14]
stale_after: 2027-04-09
generated:
  by: claude-code
  at: 2026-10-09T00:00:00Z
---

# `settings-model-list`

Keep the model lists of a settings file consistent with the way Claude Code reads them.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

Some entries of a model list have no effect, or have an effect that the author did not intend.
The rule reports each one. The rule reads the linted file. In a managed file, it also reads the sibling files of the same
managed source. A key in any other file is not seen. The aliases and the ID forms are in `src/data/models.ts`.

| Check | Files | The docs say |
|-------|-------|--------------|
| `fallbackModel` has more than 3 distinct entries | every file | "Claude Code caps chains at three models after duplicate removal and ignores extra entries."[^chains] |
| `availableModels` is `[]` and the file names a model | managed files | "With `availableModels: []`, named model selections are blocked and `enforceAvailableModels` has no effect."[^behavior] |
| `enforceAvailableModels: true` with no non-empty `availableModels` | managed files | "This key has no effect when `availableModels` is unset or empty."[^enforce] |
| An `availableModels` family alias with a same-family ID | every file | "an entry naming a specific model in a family ... disables that family's wildcard entry: `["sonnet", "claude-sonnet-4-5"]` allows only Sonnet 4.5 versions, not every Sonnet model."[^merge] |
| `best`, `opusplan` or `default` in `deniedModels` | managed files | "`best`, `opusplan`, and `default` entries are ignored"[^denied] |
| A `modelOverrides` key that is no Anthropic model ID | every file | "Keys must be Anthropic model IDs ... Unknown keys are ignored."[^overrides] |
| `env.ANTHROPIC_CUSTOM_MODEL_OPTION` that `availableModels` omits | managed files | "include the custom model ID in the allowlist as well. Otherwise Claude Code filters the custom entry from the picker and rejects a `--model` selection of it"[^custom] |

The report is on the entry, the key or the value that Claude Code does not act on. A `null`
value removes a key, so the rule takes it as no key. For two keys of one name, the rule reads the
last, as `JSON.parse` does. A hidden file in `managed-settings.d/` gets no report, because Claude
Code ignores it.

### The fallback chain

The rule counts distinct strings in `fallbackModel`. A duplicate is not a new model. The report is
on the first entry over the limit. The settings reference says that Claude Code "keeps at most three distinct allowed models".[^fallback] Claude Code also drops each entry that `availableModels` does
not permit when it reads the chain.[^chains] The rule counts all entries.

The docs cap the chain at 3 models and name no setting that moves the cap. The option `max` takes a
lower number, and the schema refuses a number above 3. At 3, the message says that Claude Code
ignores the entry. At another value, the message names the configured limit, and does not say that
Claude Code acts at that number.

### An empty `availableModels`

The rule reports `availableModels: []` only when the same file sets `model`, `advisorModel` or a
`fallbackModel` entry, none of them `default` or empty. Such a key names a model that the empty
list blocks. An empty list alone can be a lock-down on purpose, so it gets no report. The rule
checks a managed file only. Lists of the user, project and local files are "concatenated and
deduplicated",[^merge] so a project file can pair with a list in the user file.

### A family alias and a same-family ID

`["sonnet", "claude-sonnet-4-5"]` allows Sonnet 4.5 and not the other Sonnet models.[^merge] The
rule reports the alias entry. The ID can be a dated ID, an ID with `[1m]`, or a provider ID that
embeds a `claude-` name.[^custom] An ID with no `claude-` name, such as an ARN of an inference
profile, has no family for the rule.

### Managed keys

`deniedModels` is a managed-only key. Claude Code reads `enforceAvailableModels` from the managed
source when an organization deploys managed settings. The docs say to deploy `availableModels` and
`enforceAvailableModels` together in the highest-ranked managed source.[^enforce-pair] So the rule
checks these two keys in a managed file only. A project or local file can pair with a list in a
user file. The rule does not see that file. `settings-key-scope` reports `deniedModels` in a
project file, so this rule makes no second report.

A managed source is `managed-settings.json` and its drop-ins. Lists combine across the files.
Three checks need the whole list: the empty list, `enforceAvailableModels` and the custom option.
The rule runs them in a managed file and reads the sibling files for them. It makes no report when
a sibling holds an entry, or when it cannot read a sibling.

### The custom model option

The rule reports the option when the file sets `availableModels` and no entry permits the option.
An entry permits the option when it equals the option, is a version prefix of it, or is its
family alias. The aliases `best`, `opusplan` and `default` permit every option. The settings
reference says that `claude-opus-5` also permits later versions that extend it, such as Opus 5.5.
The rule reads "extend" as "add a segment": `claude-opus-5` permits `claude-opus-5-5` and not
`claude-opus-55`. The `[1m]` suffix is removed from both sides.[^custom-match] The rule makes no
report when a doubt remains.

### What the rule does not check

- A model that does not exist. The rule checks the form of a `modelOverrides` key, not the model
  list of Anthropic.
- A value of a wrong type. `settings-schema` is for that. The rule skips an entry that is not a
  string.
- A model value. `settings-model-value` is for the form of a model alias or ID.
- Which `availableModels` entries Claude Code ignores for `availableModelsMatch: "exact"`.

Fail, in `managed-settings.json`:

```json
{
  "availableModels": ["sonnet", "claude-sonnet-4-5"],
  "fallbackModel": ["opus", "sonnet", "haiku", "fable"],
  "deniedModels": ["best"],
  "modelOverrides": { "opus": "arn:aws:bedrock:us-east-1:123456789012:inference-profile/x" },
  "enforceAvailableModels": true
}
```

Pass:

```json
{
  "availableModels": ["claude-sonnet-4-5", "haiku"],
  "fallbackModel": ["claude-sonnet-4-5", "haiku"],
  "deniedModels": ["claude-opus-5-5"],
  "modelOverrides": { "claude-opus-4-7": "arn:aws:bedrock:us-east-1:123456789012:inference-profile/x" },
  "enforceAvailableModels": true
}
```

## Options

| Option | Type | Default | Schema maximum |
|--------|------|---------|----------------|
| `max` | integer, at least 1 | 3 | 3 |

`max` is the most distinct entries of `fallbackModel`. The `recommended` and `strict` configs set
no option.

## Sources

[^chains]: [Model configuration: Fallback model chains](https://code.claude.com/docs/en/model-config#fallback-model-chains)
[^behavior]: [Model configuration: Default model behavior](https://code.claude.com/docs/en/model-config#default-model-behavior)
[^enforce]: [All settings: enforceAvailableModels](https://code.claude.com/docs/en/settings-reference#enforceavailablemodels)
[^enforce-pair]: [Model configuration: Enforce the allowlist for the Default model](https://code.claude.com/docs/en/model-config#enforce-the-allowlist-for-the-default-model)
[^merge]: [Model configuration: Merge behavior](https://code.claude.com/docs/en/model-config#merge-behavior)
[^denied]: [All settings: deniedModels](https://code.claude.com/docs/en/settings-reference#deniedmodels)
[^overrides]: [Model configuration: Override model IDs per version](https://code.claude.com/docs/en/model-config#override-model-ids-per-version)
[^custom]: [Model configuration: Add a custom model option](https://code.claude.com/docs/en/model-config#add-a-custom-model-option)
[^custom-match]: [Model configuration: Pin models for third-party deployments](https://code.claude.com/docs/en/model-config#pin-models-for-third-party-deployments)
[^fallback]: [All settings: fallbackModel](https://code.claude.com/docs/en/settings-reference#fallbackmodel)
