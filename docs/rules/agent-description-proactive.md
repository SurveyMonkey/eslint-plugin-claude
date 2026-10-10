---
type: Reference
description: The ESLint rule claude/agent-description-proactive, which reports a subagent file whose description has no phrase such as use proactively, because the docs advise that phrase to encourage delegation.
owner: brianespinosa
created: 2026-10-10
related_issues: [9]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `agent-description-proactive`

Put a phrase such as "use proactively" in the description of a subagent.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/*.md`, in the agent folders |

The rule is `off` in `recommended`. The rule is a heuristic.

## Rule details

Claude Code delegates a task to a subagent by the `description` of the agent. The docs say: "To
encourage proactive delegation, include phrases like "use proactively" in your subagent's
description field."[^delegation]

The rule reports a `description` that does not contain the word "proactively". It ignores letter
case, so "use proactively" and "use PROACTIVELY" both pass. The report is on the value of the
`description`. The word "proactive" alone does not pass, because the docs name the phrase with
"proactively".

The rule is a heuristic. An agent that you start by hand only does not need the phrase. Turn the
rule off for such an agent, or do not enable it.

The rule checks these files:

- A local agent in `.claude/agents/`, at any depth.
- A plugin agent in the `agents/` directory of a plugin, at any depth.
- A file that the manifest key `agents` of a plugin names. The key replaces the `agents/`
  directory, so a file in that directory that the key does not name is not an agent.[^replace]

A plugin root is a directory with `.claude-plugin/plugin.json`. A manifest that the rule cannot
read gives no report for a file outside `agents/`. The rule reads no file out of the repository
(ADR 001, Decision 14). A manifest path that leaves the plugin or the repository names no agent.

The rule is silent in these cases:

- The `description` is not there, is empty, or is not a string. Other rules report these faults.
- The file has no frontmatter, or the frontmatter does not parse.
- The file is not an agent file, such as `docs/agents/a.md`.

Fail:

```markdown
---
name: reviewer
description: Reviews code.
---
```

Pass:

```markdown
---
name: reviewer
description: Reviews code. Use proactively after a change.
---
```

## Sources

[^delegation]: [Create custom subagents: Understand automatic delegation](https://code.claude.com/docs/en/sub-agents#understand-automatic-delegation)
[^replace]: [Plugin manifest reference: How each key combines with its default location](https://code.claude.com/docs/en/plugins/manifest-reference#how-each-key-combines-with-its-default-location)
