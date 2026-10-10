---
type: Reference
description: The ESLint rule claude/agent-model-value, which reports a subagent model that is not an alias, inherit or a claude- model ID, with a provider form accepted and an allow option for other values.
owner: brianespinosa
created: 2026-10-10
related_issues: [9]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `agent-model-value`

Set the model of a subagent to an alias, `inherit`, or a model ID.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | load | `**/agents/**/*.md`, in `.claude/agents/` and in the `agents/` directory of a plugin |

The rule is `off` in `recommended`.

## Rule details

The `model` field takes `sonnet`, `opus`, `haiku`, `fable`, a full model ID such as
`claude-opus-5-5`, or `inherit`.[^fields][^choose] The docs say that a full ID "accepts the same
values as the `--model` flag". That flag takes the aliases of the model configuration page.[^aliases]

The rule accepts these values:

- `inherit`.
- An alias: `sonnet`, `opus`, `haiku`, `fable`, `best` or `opusplan`. An alias takes the suffix
  `[1m]`.
- The value `default`. The model configuration page says that it is not itself an alias.
- A model ID: `claude-` and a name, with no space, and the optional suffix `[1m]`.
- A provider form: an Amazon Bedrock ARN, an `anthropic.` ID, or an ID that embeds a `claude-`
  model name, such as `us.anthropic.claude-opus-4-8`.
- A value in the option `allow`.

The docs do not say if Claude Code treats upper and lower case of an alias as different. The rule
treats them as the same for `inherit` and for the aliases. A `claude-` model ID stays
case-sensitive. [`settings-model-value`](settings-model-value.md) is case-sensitive for all values,
so `Sonnet` is silent here and reported there.

The sub-agents page lists four aliases and `inherit`. The rule also accepts the other aliases of the
model configuration page. The sub-agents page says that a full ID takes the values of `--model`. The rule
cannot tell which models a provider or a gateway accepts, so it is a heuristic. A custom model value
goes in the option `allow`.

The report is on the value of `model`. A value that is not a string, or is empty, gets no report from
this rule. [`agent-frontmatter-schema`](agent-frontmatter-schema.md) reports it.
[`agent-model-forced`](agent-model-forced.md) reports a `model` that a setting makes void.

The rule reads one file and makes no report that rests on another file.

Fail:

```markdown
---
name: code-reviewer
description: Reviews code
model: sonet
---
```

Pass:

```markdown
---
name: code-reviewer
description: Reviews code
model: sonnet
---
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `allow` | `[]` | Model values that the rule cannot judge, such as the ID of a gateway. Each is an exact match. |

```js
'claude/agent-model-value': ['warn', { allow: ['team-gateway-model'] }]
```

## Sources

[^fields]: [Create custom subagents: Frontmatter reference](https://code.claude.com/docs/en/sub-agents#supported-frontmatter-fields)
[^choose]: [Create custom subagents: Choose a model](https://code.claude.com/docs/en/sub-agents#choose-a-model)
[^aliases]: [Model configuration: Model aliases](https://code.claude.com/docs/en/model-config#model-aliases)
