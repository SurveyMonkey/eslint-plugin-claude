---
type: Reference
description: The ESLint rule claude/agent-tools-agent-type-list, which reports an Agent(type) or Task(type) list in the tools of a local subagent file that no committed agent setting runs as the main thread, and a listed type that no agent defines when one does.
owner: brianespinosa
created: 2026-10-10
related_issues: [9]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `agent-tools-agent-type-list`

Use an `Agent(type)` list only in an agent that runs as the main thread.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | no-op | `**/agents/**/*.md`, in `.claude/agents/` |

The rule is `off` in `recommended`.

## Rule details

The `Agent(agent_type)` syntax in `tools` limits which subagents an agent can spawn. The docs say
that the syntax "applies only to an agent running as the main thread with `claude --agent`". In a
subagent definition, "any type list inside the parentheses is ignored".[^restrict] The `agent` setting
also runs an agent as the main thread.[^invoke] `Task(type)` is the old name of `Agent(type)`, and
works as an alias.[^restrict]

The rule reports in two cases. The report is on the `tools` entry.

- No committed `agent` setting names the agent, so the list is ignored in a subagent run.
- A committed `agent` setting names the agent, and the list holds a type that no agent defines. The
  agent cannot spawn that type. One report covers all unknown types of an entry.

A type is known when it is a built-in agent. It is also known when it is the `name` of a file in
`.claude/agents/` of the project folder, or of a folder above it, up to the repository root. The
docs do not say if Claude Code treats upper and lower case as different. The rule treats them as
the same. A type with a `:` names the agent of a plugin, and the rule cannot see it.

The rule is a heuristic. It cannot see the `--agent` flag. Name an agent that the team starts
with the flag in the option `allow`. That silences the first report, and the type list of that agent
is then checked. The same option lists agent types from outside the repository, such as agents in
`~/.claude/agents/`. That silences the second report. The rule compares an agent name with `allow`
in exact case, and a type in any case.

The rule reads `settings.json` and `settings.local.json` in `.claude/` of the project folder and of
each folder above it, up to the repository root. It reads no managed or user settings. It
reads no file out of the repository (ADR 001, Decision 14).

The rule is silent in these cases:

- The agent is in a plugin. The docs do not say how a plugin agent becomes the main thread, and the
  rule cannot tell.
- The entry is `Agent` or `Task` with no parentheses, or with an empty list.
- The entry is in `disallowedTools`. [`agent-disallowed-tools-scope`](agent-disallowed-tools-scope.md)
  reports a specifier there.
- The `name` is not a string, or is empty. The rule has no name to compare.
- A settings file or an agents folder cannot be seen. A scan cannot see a file that it cannot read,
  or a link out of the repository. The rule adds no message for this case.

Fail, with no `agent` setting for `coordinator`:

```markdown
---
name: coordinator
description: Coordinates work across specialized agents
tools: Agent(worker, researcher), Read, Bash
---
```

Pass: the same agent with `{"agent": "coordinator"}` in `.claude/settings.json`, and the files
`worker.md` and `researcher.md` in `.claude/agents/`.

## Options

| Option | Default | Use |
|--------|---------|-----|
| `allow` | `[]` | Names of agents that the team starts with `--agent`, and agent types from outside the repository. |

```js
'claude/agent-tools-agent-type-list': ['warn', { allow: ['coordinator', 'user-agent'] }]
```

## Sources

[^restrict]: [Create custom subagents: Restrict which subagents can be spawned](https://code.claude.com/docs/en/sub-agents#restrict-which-subagents-can-be-spawned)
[^invoke]: [Create custom subagents: Invoke subagents explicitly](https://code.claude.com/docs/en/sub-agents#invoke-subagents-explicitly)
