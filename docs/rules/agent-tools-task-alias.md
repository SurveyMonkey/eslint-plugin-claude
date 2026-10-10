---
type: Reference
description: The ESLint rule claude/agent-tools-task-alias, which reports Task or Task(...) in the tools or disallowedTools of a subagent file, because Claude Code v2.1.63 renamed the Task tool to Agent and keeps Task only as an alias.
owner: brianespinosa
created: 2026-10-10
related_issues: [9]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `agent-tools-task-alias`

Write Agent, not its old name Task, in the tools of a subagent.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | deprecated | `**/agents/**/*.md`, in `.claude/agents/` and in the `agents/` directory of a plugin |

## Rule details

Claude Code v2.1.63 renamed the Task tool to Agent. The docs say that existing `Task(...)` references in settings and
agent definitions still work as aliases.[^restrict] The old name works, but new files and docs use `Agent`.

The rule reports each `Task` and `Task(...)` entry in `tools` and in `disallowedTools`. The report is on the entry. A tool
whose name only starts with `Task`, such as `TaskCreate`, is another tool and gets no report. An entry that does not
parse gets no report.

The rule has no fix. A team that runs a Claude Code version before v2.1.63 needs `Task`, because those versions do not
know `Agent`. The rule is a `warn` rule for this reason. [`agent-tools-known`](agent-tools-known.md) accepts `Task`.

Fail:

```markdown
---
name: coordinator
description: Coordinates work across specialized agents
tools: Task(worker, researcher), Read, Bash
---
```

Pass:

```markdown
---
name: coordinator
description: Coordinates work across specialized agents
tools: Agent(worker, researcher), Read, Bash
---
```

## Options

None.

## Sources

[^restrict]: [Create custom subagents: Restrict which subagents can be spawned](https://code.claude.com/docs/en/sub-agents#restrict-which-subagents-can-be-spawned)
