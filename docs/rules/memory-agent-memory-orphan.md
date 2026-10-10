---
type: Reference
description: The ESLint rule claude/memory-agent-memory-orphan, off in recommended and warn in strict, which reports a .claude/agent-memory/name folder that no project or plugin subagent in the repository owns with memory project, with an allow option for user subagents.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `memory-agent-memory-orphan`

Keep agent memory only for a subagent that sets `memory: project`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | consistency | `**/.claude/agent-memory/*/MEMORY.md` |

The rule is `off` in `recommended`.

## Rule details

A subagent with `memory: project` keeps its notes in `.claude/agent-memory/<name>/`.[^memory] A
folder whose name matches no such subagent is an orphan. It can be left from a subagent that was
renamed, deleted or moved to another memory scope.

The rule reports a `MEMORY.md` index at `.claude/agent-memory/<name>/MEMORY.md` when no subagent in
the repository has `name: <name>` and `memory: project`. It reports once for each folder, at the
start of the index. It scans the whole repository below the folder that holds `.git`, and counts:

- A project subagent file in a `.claude/agents/` folder, at any depth, in any package.
- A plugin subagent file in the `agents/` folder of a plugin root in the repository.

The rule lints the `MEMORY.md` index only. A folder with no `MEMORY.md` gets no check.

A user subagent in `~/.claude/agents/` can own the folder too, and a managed or CLI-defined
subagent as well. The plugin does not read a file out of the repository (ADR 001, Decision 14). So
the option `allow` lists the names of such subagents. The rule makes no report for a name in the
list.

The rule makes no report in these cases:

- The index is not in a repository. The rule reads nothing there.
- The rule cannot read a part of the repository: a folder or a subagent file with no read right,
  or a link that leads out of the repository. The part may hold the subagent.

A subagent file without frontmatter, with YAML that does not parse, or with a `name` or `memory`
that is not a string has no usable name. It does not own a folder. The rule cannot tell a missing
block from a block that does not parse.

The rule is a heuristic.

Fail, when no subagent is named `reviewer`:

```text
.claude/agent-memory/reviewer/MEMORY.md
```

Pass, when `.claude/agents/reviewer.md` has this frontmatter:

```yaml
---
name: reviewer
description: Reviews code
memory: project
---
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `allow` | `[]` | Names of subagents that the repository does not hold, such as user subagents. |

```js
'claude/memory-agent-memory-orphan': ['warn', { allow: ['my-user-agent'] }]
```

## Sources

[^memory]: [Create custom subagents: Enable persistent memory](https://code.claude.com/docs/en/sub-agents#enable-persistent-memory)
