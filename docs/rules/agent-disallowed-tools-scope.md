---
type: Reference
description: The ESLint rule claude/agent-disallowed-tools-scope, which reports a disallowedTools entry with a specifier, because it removes the whole tool, and a tool that tools and disallowedTools both list, because Claude Code removes it.
owner: brianespinosa
created: 2026-10-10
related_issues: [9]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `agent-disallowed-tools-scope`

Use disallowedTools for a whole tool, and permissions.deny for a part of it.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/agents/**/*.md`, in `.claude/agents/` and in the `agents/` directory of a plugin |

## Rule details

The `disallowedTools` field removes tools from the subagent. A specifier does not narrow the removal. An entry such as
`Bash(git push *)` "still removes the whole tool from the subagent, not only the matching commands".[^available]
The subagent then has no `Bash` tool. To keep `Bash` and block some commands, add a deny rule to `permissions.deny` in
the settings. That rule applies to the main conversation and to subagents.[^available]

The rule reports two cases:

- **A specifier.** A `disallowedTools` entry has parentheses, as in `Bash(git push *)` or `Read(.env)`. The report is
  on the entry.
- **A tool in both lists.** The docs apply `disallowedTools` first, and then resolve `tools` against the tools that
  remain. A tool in both lists is removed.[^available] So the entry in `tools` has no effect. The report is on the
  `tools` entry. The rule compares the tool names, so `Bash` in `tools` and `Bash(git push *)` in `disallowedTools`
  give both reports.

The rule compares names as written. It does not treat `Task` as `Agent`, and it does not match
`mcp__github__search` to `mcp__github`. An entry that does not parse gets no report.
[`agent-tools-known`](agent-tools-known.md) reports it.

Fail:

```markdown
---
name: reviewer
description: Reviews code.
disallowedTools: Bash(git push *)
---
```

Pass:

```markdown
---
name: reviewer
description: Reviews code.
disallowedTools: Write, Edit
---
```

## Options

None.

## Sources

[^available]: [Create custom subagents: Available tools](https://code.claude.com/docs/en/sub-agents#available-tools)
