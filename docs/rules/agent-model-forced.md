---
type: Reference
description: The ESLint rule claude/agent-model-forced, which reports a local subagent file that sets model while the committed settings set CLAUDE_CODE_SUBAGENT_MODEL_FORCE, because Claude Code then uses one model for each subagent.
owner: brianespinosa
created: 2026-10-05
related_issues: [9]
stale_after: 2027-04-01
generated:
  by: claude-code
  at: 2026-10-05T00:00:00Z
---

# `agent-model-forced`

Do not set `model` in a local agent when the settings force one subagent model.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/agents/**/*.md` |

## Rule details

The variable `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` set to `1` applies one model to every subagent.[^force]
The `model` field of an agent then has no effect. The rule reports the `model` field of a local agent
in `.claude/agents/` when the `env` key of `.claude/settings.json` or `.claude/settings.local.json`
sets the variable to `1` or `true`. The docs show only the value `1`. The rule also takes `true`, in any case.

The rule reads both settings files of the `.claude/` directory that holds the agent. When both files
set a key, the local file wins.[^precedence] The two `env` objects merge by key. The settings page calls `env` an
ordinary key, so a local `env` could replace the project `env`. The merge by key is the choice of
the plugin. A local file that sets the variable to `0` turns the
report off.

The rule reports local agents only. A plugin agent gets no report, because the settings of a plugin
user are not in the plugin repository. The rule also checks only a `model` that is a string. Managed
and user settings are not in the repository, so the rule does not read them.

The rule makes no report that rests on a file that it cannot read. This holds when a settings file
cannot be read, is a dangling link, has a real path out of the repository, or does not parse to an
object. A file that is not there gives no report. The rule adds no message for this case.

Fail, with `{"env": {"CLAUDE_CODE_SUBAGENT_MODEL_FORCE": "1"}}` in `.claude/settings.json`:

```markdown
---
name: reviewer
description: Reviews code.
model: haiku
---
```

Pass: the same agent without `model`, or settings that leave out the variable.

## Options

None.

## Sources

[^force]: [Create custom subagents: Run every subagent on one model](https://code.claude.com/docs/en/sub-agents#run-every-subagent-on-one-model)
[^precedence]: [Claude Code settings: Settings precedence](https://code.claude.com/docs/en/settings#settings-precedence)
