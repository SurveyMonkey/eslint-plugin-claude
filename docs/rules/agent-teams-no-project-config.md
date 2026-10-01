---
type: Reference
description: The ESLint rule claude/agent-teams-no-project-config, which reports each Markdown and JSON file under .claude/teams/, because Claude Code has no project-level team config and reads such a file as an ordinary file.
owner: brianespinosa
created: 2026-10-01
related_issues: [9]
stale_after: 2027-04-01
generated:
  by: claude-code
  at: 2026-10-01T00:00:00Z
---

# `agent-teams-no-project-config`

Do not keep a team config file in `.claude/teams/`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/teams/**/*.md`, `**/.claude/teams/**/*.json` |

## Rule details

Claude Code keeps the config of a team in `~/.claude/teams/{team-name}/config.json`. It writes the
file at the start of a session, and removes it at the end. There is no project-level equivalent. A
file such as `.claude/teams/teams.json` in a project is not configuration: Claude Code reads it as an
ordinary file.[^arch] To define teammate roles that a project shares, use subagent definitions.

The rule reports each file under `.claude/teams/` at any depth, at line 1.

ESLint lints a file only when a language of the plugin reads it. The plugin has Markdown and JSON, so
the rule sees `.md` and `.json` files. It does not see a `.yaml`, `.txt` or other file there.

Fail:

```text
// .claude/teams/teams.json
{ "members": [] }
```

Pass:

```text
// Define the teammate role as a subagent: .claude/agents/reviewer.md
---
name: reviewer
description: Reviews code.
---
```

## Options

None.

## Sources

[^arch]: [Orchestrate teams of Claude Code sessions: Architecture](https://code.claude.com/docs/en/agent-teams#architecture)
