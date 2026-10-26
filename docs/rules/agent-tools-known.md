---
type: Reference
description: The ESLint rule claude/agent-tools-known, which reports an entry in the tools or disallowedTools of a subagent file that names no tool that Claude Code knows, an mcp__* pattern or a specifier in tools, or an entry that does not parse.
owner: brianespinosa
created: 2026-10-02
related_issues: [9, 15]
stale_after: 2027-03-30
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# claude/agent-tools-known

📝 Name a tool that Claude Code knows in the tools and disallowedTools of a subagent.

💼 This rule is enabled in the following configs: ✅ `recommended`, 🔒 `strict`.

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| load | `**/*.md`, in `.claude/agents/` and in the agent files of a plugin |

## Rule details

`tools` is an allowlist of the tools that a subagent can use. `disallowedTools` removes tools from the inherited or listed
set. Each takes a comma-separated string or a YAML list.[^fields] When no entry of `tools` resolves to a tool, Claude Code
usually refuses to launch the subagent. The error names each entry that it could not resolve.[^zero] The rule finds those
entries before a run.

An entry is one of these:

- a tool name from the tools table, such as `Read`. The name is case-sensitive.
- `Agent`, or `Agent(type, type)` in `tools`. `Task` is the old name of `Agent`.[^spawn] The type list limits the
  subagents of an agent that runs as the main thread with `claude --agent`. In a subagent definition, Claude Code
  ignores it.[^spawn]
- `mcp__<server>__*` or `mcp__<server>__<tool>`. In `tools`, the first grants every tool of a server. In
  `disallowedTools`, `mcp__<server>` or `mcp__<server>__*` removes every tool of a server.[^restrict]
- `mcp__*`, in `disallowedTools` only. It removes every MCP tool of any server.[^restrict]
- an entry with a specifier, such as `Bash(git push *)`, in `disallowedTools` only. It removes the whole tool, not only the commands that
  match.[^restrict]

The rule parses each entry with the same parser as the permission rules. It reports an entry that:

- does not parse, as in `Read(`
- names no known tool
- is `mcp__*` in `tools`
- has a specifier in `tools`, other than the type list of `Agent`

An empty list gives no report. The docs say that an empty `tools` list launches the subagent with no tools and no
error.[^zero] A field that is neither a string nor a list gives no report.

The docs say that the string is comma-separated. The rule splits it at each comma outside parentheses. So
`Agent(worker, researcher)` stays whole. The rule does not split at a space. A string such as `Read Grep` is one entry,
and the rule reports it. It reports at the entry.

The rule accepts each name that starts with `mcp__`, because it cannot know which servers and tools exist. For the other
names, it uses the list in `src/data/tool-names.ts`, as of Claude Code 2.1.287, and `Task`, `MultiEdit` and `Cd`. This is
the base list of [`permissions-unknown-tool`](permissions-unknown-tool.md), without the tools of its option.

The permission grammar rules do not read these fields. Only `disallowedTools` takes a specifier, and the specifier still
removes the whole tool. So the entries are not permission rules.

Fail:

```markdown
---
name: coordinator
description: Coordinates work
tools: Read, Grpe, mcp__*, Bash(git push *)
---
```

Pass:

```markdown
---
name: coordinator
description: Coordinates work
tools: Agent(worker, researcher), Read, mcp__github__*
disallowedTools: Bash(git push *), mcp__*
---
```

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/agent-tools-known': 'error'
```

## Sources

[^fields]: [Create custom subagents: Frontmatter reference](https://code.claude.com/docs/en/sub-agents#supported-frontmatter-fields)
[^restrict]: [Create custom subagents: Restrict which tools a subagent can use](https://code.claude.com/docs/en/sub-agents#restrict-which-tools-a-subagent-can-use)
[^spawn]: [Create custom subagents: Restrict which subagents can be spawned](https://code.claude.com/docs/en/sub-agents#restrict-which-subagents-can-be-spawned)
[^zero]: [Error reference: Agent would be spawned with zero tools](https://code.claude.com/docs/en/errors#agent-would-be-spawned-with-zero-tools)
