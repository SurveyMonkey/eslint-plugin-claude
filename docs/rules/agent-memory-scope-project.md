---
type: Reference
description: The ESLint rule claude/agent-memory-scope-project, which reports memory user or local in a subagent file, because the docs name project as the recommended default scope.
owner: brianespinosa
created: 2026-10-10
related_issues: [9]
stale_after: 2027-04-01
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `agent-memory-scope-project`

Prefer memory: project, the recommended scope, in a subagent.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/agents/**/*.md` |

## Rule details

The `memory` field takes the scope `user`, `project` or `local`.[^memory] The docs call
`project` the recommended default scope. It makes the knowledge of the subagent shareable
through version control.[^tips] `user` keeps the memory in `~/.claude/agent-memory/`. `local`
keeps it in `.claude/agent-memory-local/`, out of version control.[^memory]

The rule reports the values `user` and `local`. Both are valid. Use `user` when the subagent
must learn across all projects. Use `local` when the memory must not be shared. A report on such
a file is a reminder of the default, so the rule is a `warn`.

The rule checks local agents and plugin agents, because both accept `memory`.[^plugin] It makes no
report for `project`, for a value that is not a scope, or for a file whose frontmatter does not
parse. [`agent-frontmatter-schema`](agent-frontmatter-schema.md) reports a value that is not a
scope.

Fail:

```markdown
---
name: reviewer
description: Reviews code.
memory: user
---
```

Pass:

```markdown
---
name: reviewer
description: Reviews code.
memory: project
---
```

## Options

None.

## Sources

[^tips]: [Create custom subagents: Persistent memory tips](https://code.claude.com/docs/en/sub-agents#persistent-memory-tips)
[^memory]: [Create custom subagents: Enable persistent memory](https://code.claude.com/docs/en/sub-agents#enable-persistent-memory)
[^plugin]: [Add components to a plugin: Frontmatter fields in plugin agents](https://code.claude.com/docs/en/plugins/components#frontmatter-fields-in-plugin-agents)
