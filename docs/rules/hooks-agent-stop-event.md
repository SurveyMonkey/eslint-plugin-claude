---
type: Reference
description: The ESLint rule claude/hooks-agent-stop-event, which reports a Stop hook in the frontmatter of a project subagent, because Claude Code converts it to SubagentStop.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-agent-stop-event`

Use SubagentStop, not Stop, in the hooks of a subagent.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

When a subagent runs, Claude Code converts a `Stop` hook in its frontmatter to `SubagentStop`.[^hooks][^agents]
That is the event that fires when a subagent completes.

The rule is `off` in `recommended`. The subagents page lists `Stop` in frontmatter as a pattern that works, and
the conversion makes the hook fire. `strict` turns the rule on as a warning, for a team that wants the name of
the event to match the event that fires.

The docs state the conversion for a subagent only. An agent can also run as the main session, with `--agent`
or the `agent` setting. The docs do not say that the conversion applies there. Keep `Stop` for that use only.

The rule reports a `Stop` event name that has a handler, in the frontmatter of a project subagent. It reports
at the event name.

The rule reads the frontmatter of a project agent file only. A skill, a settings file and a plugin `hooks.json`
get no report, because the docs state the conversion for subagents only. The rule reads no plugin agent,
because Claude Code ignores the `hooks` field there.

Fail, in `.claude/agents/reviewer.md`:

```markdown
---
name: reviewer
description: Review code
hooks:
  Stop:
    - hooks:
        - type: command
          command: ./summarize.sh
---
```

Pass:

```markdown
---
name: reviewer
description: Review code
hooks:
  SubagentStop:
    - hooks:
        - type: command
          command: ./summarize.sh
---
```

## Sources

[^hooks]: [Hooks reference: Hooks in skills and agents](https://code.claude.com/docs/en/hooks#hooks-in-skills-and-agents)
[^agents]: [Create custom subagents: Hooks in subagent frontmatter](https://code.claude.com/docs/en/sub-agents#hooks-in-subagent-frontmatter)
