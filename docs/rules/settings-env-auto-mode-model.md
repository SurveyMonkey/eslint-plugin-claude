---
type: Reference
description: The ESLint rule claude/settings-env-auto-mode-model, which reports a CLAUDE_CODE_AUTO_MODE_MODEL value in a settings file that is an alias and not a full model ID, or that names a model the auto mode classifier ignores. It is off in recommended.
owner: brianespinosa
created: 2026-10-25
related_issues: [394]
stale_after: 2027-04-25
generated:
  by: claude-code
  at: 2026-10-25T00:00:00Z
---

# claude/settings-env-auto-mode-model

📝 Set CLAUDE_CODE_AUTO_MODE_MODEL to a full model ID that the classifier uses.

⚠️ This rule _warns_ in the 🔒 `strict` config.

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule is `off` in `recommended`. `strict` turns it on at `warn`. The list of ignored models
can change with a model release. So the rule can go out of date between plugin releases. The list
is in `src/data/auto-mode-model.ts`.

## Rule details

`CLAUDE_CODE_AUTO_MODE_MODEL` sets the model of the auto mode classifier. It needs Claude Code
v2.1.302 or later. The docs say to set it to a full model ID, such as `claude-sonnet-4-6`.[^choose]
[^vars] The rule reads the variable in the `env` block, and makes one report on the value in two
cases.

- The value is an alias of the "Model aliases" table, or `default`: `opus`, `sonnet`, `haiku`,
  `fable`, `best`, `opusplan`, `default`, and an alias with the `[1m]` suffix.[^aliases] An alias
  is not a full model ID.
- The value names Claude Opus 5, Sonnet 5.5 or Opus 5.5. The docs say that the default classifier
  model reviews when you set one of these.[^ignored] The rule reads the family and the version of
  the ID. So `claude-opus-5`, `claude-opus-5-20260401`, `claude-opus-5-5[1m]` and
  `us.anthropic.claude-opus-5-5` all report.

The docs say that the full model IDs of a cloud provider work too.[^choose] The rule cannot
judge a provider ID, an ARN or the name of a gateway model. So it accepts any other value as text.
The rule makes no report in these cases:

- The value is not a string. `settings-env-value-format` reports it.
- The value is empty, or has a letter case that the alias table does not use, such as `SONNET`
  or `opus[1M]`.
- The value is an alias with white space before or after it, such as `" sonnet"`.
- The file is a hidden drop-in, which Claude Code does not read.

### What the rule does not check

- A model that the `availableModels` policy of your organization excludes. The docs name this
  case too.[^ignored] The rule does not compare the value with `availableModels`. A managed source
  out of the repository can also set the policy.
- A classifier model that Anthropic configured, a model that your provider cannot serve, and the
  server-side review. These are run-time state.[^ignored]
- The Claude Code version. A client before v2.1.302 ignores the variable, so the rule has no
  `minVersion` option.
- The user file `~/.claude/settings.json`. It is out of the repository.

Fail:

```json
{
  "env": {
    "CLAUDE_CODE_AUTO_MODE_MODEL": "claude-opus-5"
  }
}
```

Pass:

```json
{
  "env": {
    "CLAUDE_CODE_AUTO_MODE_MODEL": "claude-sonnet-4-6"
  }
}
```

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/settings-env-auto-mode-model': 'warn'
```

## Sources

[^choose]: [Choose a permission mode: Choose the classifier model](https://code.claude.com/docs/en/permission-modes#choose-the-classifier-model)
[^ignored]: [Choose a permission mode: When your model doesn't review](https://code.claude.com/docs/en/permission-modes#when-your-model-doesnt-review)
[^vars]: [Environment variables: Variables](https://code.claude.com/docs/en/env-vars#variables)
[^aliases]: [Model configuration: Model aliases](https://code.claude.com/docs/en/model-config#model-aliases)
