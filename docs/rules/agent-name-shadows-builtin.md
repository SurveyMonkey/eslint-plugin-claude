---
type: Reference
description: The ESLint rule claude/agent-name-shadows-builtin, which reports a local subagent whose name is the name of a built-in subagent, because the local agent replaces the built-in, with an allow option for an intended override.
owner: brianespinosa
created: 2026-10-10
related_issues: [9]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `agent-name-shadows-builtin`

Do not give a local subagent the name of a built-in subagent.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/agents/**/*.md`, in `.claude/agents/` |

## Rule details

Claude Code has six built-in subagents: `Explore`, `Plan`, `general-purpose`, `claude`, `statusline-setup` and
`claude-code-guide`.[^builtin] When two subagents have the same name, Claude Code uses the one from the higher-priority
location.[^scope] The page says that a project or user subagent named `Explore` overrides the built-in.[^builtin] The
rule applies the same reading to the other five names, because the page gives no other rule for them.

The rule reports the `name` of a local agent that is one of the six names. The match is exact and case-sensitive.
`explore` and `Explorer` are not reports.

An override can be intended. The docs show one: an `Explore` agent with `model: haiku` runs exploration on a cheaper
model.[^builtin] Add the name to the `allow` option to keep that agent without a report.

Claude Code gives a plugin agent a scoped name, such as `my-plugin:reviewer`.[^scope] So a plugin agent cannot
shadow a built-in, and the rule checks only agent files in `.claude/agents/`, at any depth. A file outside these
folders gets no report. A file with no readable `name` gets no report. [`agent-frontmatter-valid`](agent-frontmatter-valid.md)
and [`agent-frontmatter-schema`](agent-frontmatter-schema.md) report those.

The rule cannot tell a project agent from a user agent by its path. A file in `~/.claude/agents/` overrides a
built-in in the same way.

Fail:

```markdown
---
name: Explore
description: Searches the repository.
---
```

Pass:

```markdown
---
name: repo-explorer
description: Searches the repository.
---
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `allow` | `[]` | Names of built-in subagents that a local agent replaces on purpose. |

```js
'claude/agent-name-shadows-builtin': ['warn', { allow: ['Explore'] }]
```

## Sources

[^builtin]: [Create custom subagents: Built-in subagents](https://code.claude.com/docs/en/sub-agents#built-in-subagents)
[^scope]: [Create custom subagents: Choose the subagent scope](https://code.claude.com/docs/en/sub-agents#choose-the-subagent-scope)
