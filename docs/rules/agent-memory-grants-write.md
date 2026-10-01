---
type: Reference
description: The ESLint rule claude/agent-memory-grants-write, which reports a subagent file that sets memory and a tools list without Write or Edit, because memory turns on the Read, Write and Edit tools anyway.
owner: brianespinosa
created: 2026-10-01
related_issues: [9]
stale_after: 2027-04-01
generated:
  by: claude-code
  at: 2026-10-01T00:00:00Z
---

# `agent-memory-grants-write`

Do not use memory in a subagent whose tools list leaves out Write and Edit.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | security | `**/agents/**/*.md` |

## Rule details

When `memory` is on, Claude Code turns on the Read, Write and Edit tools. The
subagent uses them to manage its memory files.[^memory] This holds when the `tools` list leaves
them out. A reviewer with `tools: Read, Grep` and `memory: project` can then write files. If auto
memory is off, `memory` has no effect, and the rule reports a grant that Claude Code does not
make. The rule reports the `tools` value in this case: `memory` is `user`, `project` or `local`, and the list
leaves out `Write`, `Edit`, or both. The report names the tools that the list leaves out.

A specifier does not change the tool name: `Write(docs/**)` counts as `Write`. The rule is silent
when `tools` is absent or has no value, because the agent then inherits each tool. An empty list
`[]` is a report. It is also silent when
`tools` is neither a string nor a list of strings. `agent-frontmatter-schema` reports that fault.

Both local agents in `.claude/agents/` and plugin agents take `memory` and `tools`. So the rule
checks both, in the `agents/` directory of a plugin. A file outside these folders gets no report.
The rule ignores a file whose frontmatter does not parse.

Fail:

```markdown
---
name: reviewer
description: Reviews code.
tools: Read, Grep
memory: project
---
```

Pass:

```markdown
---
name: reviewer
description: Reviews code.
tools: Read, Grep, Write, Edit
memory: project
---
```

## Options

None.

## Sources

[^memory]: [Create custom subagents: Enable persistent memory](https://code.claude.com/docs/en/sub-agents#enable-persistent-memory)
