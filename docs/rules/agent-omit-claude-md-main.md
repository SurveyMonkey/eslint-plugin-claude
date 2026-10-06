---
type: Reference
description: The ESLint rule claude/agent-omit-claude-md-main, which reports a local subagent file that sets omitClaudeMd to true while the committed settings agent key names that agent, because Claude Code ignores the field for the main session agent.
owner: brianespinosa
created: 2026-10-05
related_issues: [9]
stale_after: 2027-04-01
generated:
  by: claude-code
  at: 2026-10-05T00:00:00Z
---

# `agent-omit-claude-md-main`

Do not set `omitClaudeMd` in a local agent that the settings run as the main thread.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/agents/**/*.md` |

## Rule details

The `agent` setting makes a subagent the default for each session in a project.[^agent] The `agent`
value is the name of the subagent. The field `omitClaudeMd: true` launches a subagent without the user,
project and local CLAUDE.md files. Claude Code ignores the field when the agent runs as the main
session agent.[^omit] The `--agent` flag overrides the `agent` setting. A session can run the agent as
a subagent, and the field then applies. The rule cannot see the flag.

The rule reports the `omitClaudeMd` field of a local agent in `.claude/agents/`. The field must be `true`.
The `agent` key of `.claude/settings.json` or `.claude/settings.local.json` must equal the `name` of the
agent. The rule compares the name as it is written, and does not compare a file name.

The rule reads both settings files of the `.claude/` directory that holds the agent. When both files
set a key, the local file wins.[^precedence] The rule reads no managed or user settings, because they are
not in the repository.

The rule reports local agents only. A plugin agent gets no report. A name or an `agent` value that is
not a string gives no report.

The rule makes no report that rests on a settings file that it cannot see. A file cannot be seen
when it cannot be read, or when it is a link to a file that is not there. A file also cannot be seen
when its real path is out of the repository, or when it does not parse to an object. A file that is
not there gives no report. The rule adds no message for this case.

Fail, with `{"agent": "reviewer"}` in `.claude/settings.json`:

```markdown
---
name: reviewer
description: Reviews code.
omitClaudeMd: true
---
```

Pass: the same agent without `omitClaudeMd`, or settings with no `agent` key for it.

## Options

None.

## Sources

[^agent]: [Create custom subagents: Invoke subagents explicitly](https://code.claude.com/docs/en/sub-agents#invoke-subagents-explicitly)
[^omit]: [Create custom subagents: Supported frontmatter fields](https://code.claude.com/docs/en/sub-agents#supported-frontmatter-fields)
[^precedence]: [Claude Code settings: Settings precedence](https://code.claude.com/docs/en/settings#settings-precedence)
