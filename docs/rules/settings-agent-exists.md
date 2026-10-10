---
type: Reference
description: The ESLint rule claude/settings-agent-exists, which reports an agent value in a project or local settings file that is no built-in agent and no agent in .claude/agents/. It is off in recommended.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-agent-exists`

Name an agent that the repository defines, or that Claude Code ships, in `agent`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | consistency | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

The rule is `off` in `recommended`. It is a heuristic, because user and plugin agents are not in the
repository. `strict` turns it on at `warn`.

## Rule details

The setting `agent` runs the main thread as a named subagent. Its value is "the name of a built-in
or custom agent".[^agent] A name that no agent has points to nothing.

The rule accepts a value that is one of these:

- A built-in agent: `Explore`, `Plan`, `general-purpose`, `claude`, `statusline-setup` or
  `claude-code-guide`.[^invoke] The data is in `src/data/agent-fields.ts`.
- The `name` field of an agent file in `.claude/agents/`. The folder can have subfolders.
- A name in the option `allow`.
- A name with a colon. That is the form of a plugin agent, and the repository cannot show it.

The docs do not say if Claude Code compares the names with case, so the rule does not.

The report is on the value.

### Where the rule looks

The rule reads the `.claude/agents/` folder of the project that holds the settings file. It also
reads that folder in each directory above the project, up to the repository root. It reads no file
out of the repository (ADR 001, Decision 14).

The rule makes no report when it cannot see an agent. It makes no report in these cases:

- A link leads out of the repository.
- The project folder is a link that leads out of the repository.
- A link in place of `.claude` or `agents/` has no target.
- The rule cannot read a folder or an agent file.

An agent in a user folder (`~/.claude/agents/`) or in a plugin is not in the repository. Name such
an agent in the option `allow`.

### Options

| Option | Type | Default | Meaning |
|--------|------|---------|---------|
| `allow` | array of strings | `[]` | Agent names to accept, such as a user agent or a plugin agent |

### What the rule does not check

- A managed file. A managed file applies to every project on a machine. The project agents that it
  names are not in the repository that holds it.
- A value that is not a string. `settings-schema` reports it.
- An empty string.
- The `--agent` flag, which takes precedence over the setting.

When a file has two `agent` keys, the rule reads the last, as `JSON.parse` does.

Fail:

```json
{
  "agent": "code-reviewer"
}
```

Pass, with `.claude/agents/code-reviewer.md` that has `name: code-reviewer`:

```json
{
  "agent": "code-reviewer"
}
```

## Sources

[^agent]: [All settings: agent](https://code.claude.com/docs/en/settings-reference#agent)
[^invoke]: [Create custom subagents: Invoke subagents explicitly](https://code.claude.com/docs/en/sub-agents#invoke-subagents-explicitly)
