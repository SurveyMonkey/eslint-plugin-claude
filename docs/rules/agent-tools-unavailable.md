---
type: Reference
description: The ESLint rule claude/agent-tools-unavailable, which reports an entry in the tools of a subagent file for a tool that Claude Code always removes from subagents, for ExitPlanMode outside plan mode, and for a built-in tool outside the background set when background is true.
owner: brianespinosa
created: 2026-10-02
related_issues: [9, 15]
stale_after: 2027-03-30
generated:
  by: claude-code
  at: 2026-10-02T00:00:00Z
---

# `agent-tools-unavailable`

Do not list in `tools` a tool that Claude Code removes from the subagent.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/agents/**/*.md`, in `.claude/agents/` and in the `agents/` directory of a plugin |

## Rule details

Claude Code removes a short list of tools from every subagent, even when `tools` lists them.[^available] The rule reports
an entry of `tools` in these cases:

- The tool is `AskUserQuestion`, `EndConversation`, `EnterPlanMode`, `ScheduleWakeup`, `WaitForMcpServers` or
  `Workflow`.
- The tool is `ExitPlanMode`, and `permissionMode` is not `plan`.
- `background` is `true`, and the tool is a built-in tool outside the background set.

A background subagent keeps each MCP tool and only some built-in tools. The set is in `src/data/tool-names.ts`:

- `Read`, `Grep`, `Glob`, `LSP`, `Bash`, `PowerShell`, `Edit`, `Write`, `NotebookEdit`
- `WebFetch`, `WebSearch`, `TodoWrite`, `Skill`, `ToolSearch`, `EnterWorktree`, `ExitWorktree`
- `Monitor`, `TaskStop`, `SendMessage`, `Artifact`, `SubagentHandback`

`Agent` and `ExitPlanMode` follow the first filter wherever the subagent runs. Claude Code removes the other built-in
tools with no error, unless the removal leaves the `tools` list with nothing.[^available][^zero]

The rule makes one report for each entry. It reports the first case that applies.

The rule reads the `tools` field only. A tool in `disallowedTools` is a removal, and the docs do not call it a fault. The
rule reads the tool name of an entry with a specifier. It skips an entry that does not parse, and an unknown name.
[`agent-tools-known`](agent-tools-known.md) reports those.

A subagent that has no `background` field runs in the background by default, and Claude Code removes the same tools. The
rule does not report that case, because the run mode is not in the file. It reports `background: true` only. A later
rule may report it.

The rule reads a plugin agent as well. The docs say Claude Code ignores `permissionMode` for a plugin subagent. The rule
does not use the plugin flag of the file, so it does not report `ExitPlanMode` when `permissionMode` is `plan`.

Fail:

```markdown
---
name: researcher
description: Researches a topic
background: true
tools: Read, CronCreate, AskUserQuestion
---
```

Pass:

```markdown
---
name: researcher
description: Researches a topic
background: true
tools: Read, Grep, WebSearch
---
```

## Options

None.

## Sources

[^available]: [Create custom subagents: Available tools](https://code.claude.com/docs/en/sub-agents#available-tools)
[^zero]: [Error reference: Agent would be spawned with zero tools](https://code.claude.com/docs/en/errors#agent-would-be-spawned-with-zero-tools)
