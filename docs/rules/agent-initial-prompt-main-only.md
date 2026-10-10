---
type: Reference
description: The ESLint rule claude/agent-initial-prompt-main-only, which reports initialPrompt in a local subagent file when no committed agent setting names that agent, because Claude Code submits the prompt only when the agent runs as the main session agent.
owner: brianespinosa
created: 2026-10-10
related_issues: [9]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `agent-initial-prompt-main-only`

Set `initialPrompt` only in a local agent that the settings run as the main thread.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | no-op | `**/agents/**/*.md`, in `.claude/agents/` |

The rule is `off` in `recommended`.

## Rule details

Claude Code submits `initialPrompt` as the first user turn "when this agent runs as the main session
agent (via `--agent` or the `agent` setting)".[^fields] In a subagent run, the field does nothing.
The `agent` setting makes an agent the main session agent.[^invoke]

The rule reports `initialPrompt` in a local agent when no committed settings file sets `agent` to
the `name` of that agent. The report is on the field. The rule is a heuristic. It cannot see the
`--agent` flag. A team can start the agent with the flag, and the rule then reports a field that works.
Name such an agent in the option `allow`.

The rule reads `settings.json` and `settings.local.json` in `.claude/` of the project folder. It
does the same in each folder above the project folder, up to the repository root. Claude Code can
start in any of these folders, so a setting in a folder above can name the agent. The rule compares the
`name` as it is written. It reads no managed or user settings, because they are not in the repository.

The rule is silent in these cases:

- The agent is in a plugin. Claude Code ignores `initialPrompt` there, and
  [`agent-plugin-ignored-fields`](agent-plugin-ignored-fields.md) reports it.
- `initialPrompt` is not a string, or has no text.
- The `name` is not a string, or is empty. The rule has no name to compare.
- A settings file cannot be seen. A file cannot be seen when it cannot be read, when it does not
  parse to an object, or when its real path is out of the repository. The rule adds no message for this
  case.

The rule reads no file out of the repository (ADR 001, Decision 14).

Fail, with no `agent` setting for `reviewer`:

```markdown
---
name: reviewer
description: Reviews code.
initialPrompt: Review the staged changes.
---
```

Pass: the same agent with `{"agent": "reviewer"}` in `.claude/settings.json`.

## Options

| Option | Default | Use |
|--------|---------|-----|
| `allow` | `[]` | Names of agents that the team starts with `--agent`. |

```js
'claude/agent-initial-prompt-main-only': ['warn', { allow: ['reviewer'] }]
```

## Sources

[^fields]: [Create custom subagents: Frontmatter reference](https://code.claude.com/docs/en/sub-agents#supported-frontmatter-fields)
[^invoke]: [Create custom subagents: Invoke subagents explicitly](https://code.claude.com/docs/en/sub-agents#invoke-subagents-explicitly)
