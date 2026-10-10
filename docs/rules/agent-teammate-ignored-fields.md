---
type: Reference
description: The ESLint rule claude/agent-teammate-ignored-fields, which reports skills, mcpServers and background true in a local subagent file when the committed settings turn agent teams on, because Claude Code does not apply them to a teammate.
owner: brianespinosa
created: 2026-10-10
related_issues: [9]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `agent-teammate-ignored-fields`

Leave out the subagent fields that Claude Code ignores for a teammate, when the settings turn agent teams on.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | no-op | `**/*.md`, in `.claude/agents/` |

The rule is `off` in `recommended`. The rule is a heuristic, and it reads more than one file.

## Rule details

A teammate can start from a subagent definition. Claude Code then applies some parts of the
definition, and not others.[^teammates]

- `skills`: Claude Code does not apply it to a teammate. The teammate loads the skills of the
  project and the user.
- `mcpServers`: an in-process teammate ignores it. A split-pane teammate applies it.
- `background: true`: Claude Code returns an error when a teammate spawns a subagent whose
  definition sets this field.[^limits]

Teammate use is a runtime fact, so the files cannot show it. They show one fact: agent teams are
on. Agent teams are off by default. The variable `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` set to `1`
turns them on.[^enable] While they are on, a subagent that Claude names launches as a
teammate.[^enable] The rule reports a field only when the committed settings turn teams on. It
cannot tell which agents Claude launches as teammates. So the rule can report a field that works,
for an agent that Claude runs as an ordinary subagent.

The rule reads `settings.json` and `settings.local.json` in the `.claude/` directory of the agent.
The local file wins. The variable counts as on for the value `1` or `true`, in any letter case. The
rule reads no managed or user settings, because they are not in the repository.

The display mode is also a runtime fact. The rule reports `mcpServers`, because the default mode is
in-process. When the committed `teammateMode` is `tmux` or `iterm2`, the rule does not report
`mcpServers`. It still reports the other two fields.

The rule checks local agents only. A plugin cannot turn agent teams on, so a plugin agent shows
no basis for a report. [`agent-plugin-ignored-fields`](agent-plugin-ignored-fields.md) reports
`mcpServers` in a plugin agent.

The report is on the key and the value of the field. The rule is silent in these cases:

- The settings do not turn teams on, or a settings file cannot be seen. A file cannot be seen when
  it cannot be read, when it does not parse to an object, or when its real path is out of the
  repository.
- `skills` or `mcpServers` has no value, or is an empty list.
- `background` is not true. The rule reads the Boolean forms that
  [`agent-field-min-version`](agent-field-min-version.md) names.
- The file has no frontmatter, or the frontmatter does not parse.

The rule reads no file out of the repository (ADR 001, Decision 14).

Fail, with `{"env": {"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"}}` in `.claude/settings.json`:

```markdown
---
name: reviewer
description: Reviews code.
skills:
  - lint
---
```

Pass: the same agent when no settings file turns agent teams on.

## Sources

[^teammates]: [Orchestrate teams of Claude Code sessions: Use subagent definitions for teammates](https://code.claude.com/docs/en/agent-teams#use-subagent-definitions-for-teammates)
[^limits]: [Orchestrate teams of Claude Code sessions: Limitations](https://code.claude.com/docs/en/agent-teams#limitations)
[^enable]: [Orchestrate teams of Claude Code sessions: Enable agent teams](https://code.claude.com/docs/en/agent-teams#enable-agent-teams)
