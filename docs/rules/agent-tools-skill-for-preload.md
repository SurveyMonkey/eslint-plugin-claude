---
type: Reference
description: The ESLint rule claude/agent-tools-skill-for-preload, which reports a bare Skill entry in the tools of a subagent file that has no skills to preload, because the skills field preloads skills and Skill in tools does not.
owner: brianespinosa
created: 2026-10-10
related_issues: [9]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `agent-tools-skill-for-preload`

Preload skills with the `skills` field, not with `Skill` in `tools`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/agents/**/*.md`, in `.claude/agents/` and in the `agents/` directory of a plugin |

The rule is `off` in `recommended`.

## Rule details

The `tools` field lists the tools that a subagent can use. The docs say: "To preload Skills into
context, use the `skills` field rather than listing `Skill` here".[^fields] A `Skill` entry in `tools`
lets the subagent call the Skill tool. It does not inject the text of a skill into the subagent.[^preload]

The rule reports a bare `Skill` entry in `tools` when `skills` has no entry. The report is on the
entry. A `skills` field with no value, or with an empty list, preloads nothing. The rule
treats that field as absent.

The rule is a heuristic. A subagent can use `Skill` on purpose, to invoke a skill during its run.
The docs say that a subagent can invoke project, user and plugin skills through the Skill tool.[^preload]
Turn the rule off for such a subagent.

The rule does not check these cases:

- `Skill(name)` in `tools`. A specifier is not valid in `tools`.
  [`agent-tools-known`](agent-tools-known.md) reports it.
- `Skill` in `disallowedTools`. That entry removes the tool.
- A `skills` value that is not a list. [`agent-frontmatter-schema`](agent-frontmatter-schema.md)
  reports it.

The rule reads one file and makes no report that rests on another file.

Fail:

```markdown
---
name: api-developer
description: Implement API endpoints with team conventions
tools: Read, Edit, Skill
---
```

Pass:

```markdown
---
name: api-developer
description: Implement API endpoints with team conventions
tools: Read, Edit
skills:
  - api-conventions
---
```

## Options

None.

## Sources

[^fields]: [Create custom subagents: Frontmatter reference](https://code.claude.com/docs/en/sub-agents#supported-frontmatter-fields)
[^preload]: [Create custom subagents: Preload skills into subagents](https://code.claude.com/docs/en/sub-agents#preload-skills-into-subagents)
