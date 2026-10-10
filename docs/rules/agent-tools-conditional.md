---
type: Reference
description: The ESLint rule claude/agent-tools-conditional, which reports a tools entry of a subagent file for a built-in tool that a background subagent loses when background is not true, and a tools list of Agent alone, which resolves to nothing at the depth limit.
owner: brianespinosa
created: 2026-10-10
related_issues: [9]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `agent-tools-conditional`

Do not list in tools a tool that a background or nested subagent loses.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | no-op | `**/agents/**/*.md`, in `.claude/agents/` and in the `agents/` directory of a plugin |

## Rule details

Some `tools` entries have no effect in some runs of the subagent. The file does not show the run mode or the depth
of the run. So the rule is a `warn` rule, and it reports two cases.

**A tool that a background subagent loses.** A background subagent keeps every MCP tool, but only some built-in tools.
Claude Code removes every other built-in tool from it, even when `tools` lists the tool. The background is the default
run mode.[^available] The removal gives no error, unless it leaves the list with no tool.[^zero] The rule reports an
entry for a built-in tool outside the background set when `background` is not `true`. It reports when `background` is
absent, empty or `false`. The set is in `src/data/tool-names.ts`.

[`agent-tools-unavailable`](agent-tools-unavailable.md) reports the same entries when `background` is `true`, as an
`error`. It also reports the tools that no subagent keeps, such as `AskUserQuestion`. This rule leaves those tools out,
so one entry gets one report. A value of `background` that is not a Boolean gets no report. [`agent-frontmatter-schema`](agent-frontmatter-schema.md)
reports it.

**A list of `Agent` alone.** Claude Code withholds `Agent` from a subagent at the depth limit.[^zero] A `tools` list
with only `Agent` then resolves to nothing, and Claude Code usually refuses to launch the subagent. The rule reports
the first entry when every entry is `Agent`, `Agent(...)`, `Task` or `Task(...)`. `Task` is the old name of `Agent`. A
type list in parentheses does not change the result: a subagent ignores it.[^restrict] The rule makes no report for an
entry that does not parse, because the list may then hold another tool.

The rule reads the `tools` field only. It skips an unknown name, and an MCP name. [`agent-tools-known`](agent-tools-known.md)
checks the names.

Fail:

```markdown
---
name: researcher
description: Researches a topic
tools: Read, CronCreate
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
[^restrict]: [Create custom subagents: Restrict which subagents can be spawned](https://code.claude.com/docs/en/sub-agents#restrict-which-subagents-can-be-spawned)
[^zero]: [Error reference: Agent would be spawned with zero tools](https://code.claude.com/docs/en/errors#agent-would-be-spawned-with-zero-tools)
