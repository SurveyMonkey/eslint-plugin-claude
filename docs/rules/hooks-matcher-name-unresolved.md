---
type: Reference
description: The ESLint rule claude/hooks-matcher-name-unresolved, which reports a hook that names a tool, a subagent or an MCP server that Claude Code or the repository does not define.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-matcher-name-unresolved`

Name a tool, a subagent and an MCP server that exist in a hook.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

A hook that names a tool or a subagent that does not exist never fires, and Claude Code gives no warning. The docs
say that "a misspelled tool name produces a matcher that matches nothing".[^check] The rule checks three names. It
reads only an exact-match value, so a regular expression gets no report.

- **A tool name.** The rule reads the matcher of a group on a tool event. It reports a value that is not a built-in
  tool in `src/data/tool-names.ts`, `Task`, `MultiEdit` or `Cd`. A name that starts with `mcp__` is an MCP tool,
  and gets no report. This check needs no other file.
- **A subagent name.** The rule reads the matcher of a group on `SubagentStart` and `SubagentStop`. The matcher
  is the `name` of a subagent.[^subagents] The rule compares it with the built-in agents[^builtin] and with the
  `name` of each file in `.claude/agents/`, in the folder of the settings file and in each folder above it, up to
  the repository root. Claude Code skips an agent file with no `name`, a `name` that starts with `-`, holds `:` or
  is longer than 256 characters, a `name` and no `description`, or YAML that does not parse (see "Subagent files
  Claude Code skips" on the [subagents page](https://code.claude.com/docs/en/sub-agents)). Such a file defines no
  agent, so the rule ignores it. The comparison ignores case, because the docs do not say if Claude Code compares agent
  names with case.
- **An MCP server name.** The rule reads the `server` of an `mcp_tool` handler. The docs call it the "Name of a configured
  MCP server".[^mcp] The rule compares it with the `mcpServers` keys of `.mcp.json`, in the same folders. Project
  servers go in `.mcp.json`, because `settings.json` does not read an `mcpServers` key.[^causes] A plugin-scoped
  name such as `plugin:my-plugin:db` gets no report.

The agent and server checks rest on an absence, so they read inside the repository only (ADR 001, Decision 14).
The rule makes no report for a kind of name when it cannot read one source of that kind. These cases count: a
folder or a file with no read access, a link that leads out of the repository, a link with no target in the
agents folder (an agent can hide behind it), and a `.mcp.json` that does not parse. The rule also makes no report when the repository has no agent
file or no `.mcp.json`, because a user-level agent or a user-scope server can fill the gap.

The rule is `off` in `recommended`, because it is a heuristic. A user-level agent in `~/.claude/agents/`, a server
in `~/.claude.json` and a tool of a newer Claude Code are outside the repository. The option `allow` lists such names.

The rule makes no report for a case variant of a tool name, or for the advisor tool.
[`hooks-matcher-never-matches`](hooks-matcher-never-matches.md) reports both. It makes no report for a bare MCP
server name in a matcher. [`hooks-matcher-mcp-name`](hooks-matcher-mcp-name.md) reports that.

The rule reads the agent and server names for a project settings file in a `.claude` folder only. A plugin
`hooks.json`, a managed file, a skill and an agent file get the tool check alone.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, no plugin agent, and no `hooks.json` that Claude Code does not read.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "Edt", "hooks": [{ "type": "command", "command": "./check.sh" }] }]
  }
}
```

Pass:

```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "Edit", "hooks": [{ "type": "command", "command": "./check.sh" }] }]
  }
}
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `allow` | `[]` | Names that the repository does not define: a tool, a user-level agent or a user-scope MCP server. Optional. |

```js
'claude/hooks-matcher-name-unresolved': ['warn', { allow: ['my-user-agent', 'my-user-server'] }]
```

## Sources

[^check]: [Debug your configuration: Check hooks](https://code.claude.com/docs/en/debug-your-config#check-hooks)
[^subagents]: [Subagents: Project-level hooks for subagent events](https://code.claude.com/docs/en/sub-agents#project-level-hooks-for-subagent-events)
[^builtin]: [Subagents: Built-in subagents](https://code.claude.com/docs/en/sub-agents#built-in-subagents)
[^mcp]: [Hooks reference: MCP tool hook fields](https://code.claude.com/docs/en/hooks#mcp-tool-hook-fields)
[^causes]: [Debug your configuration: Check common causes](https://code.claude.com/docs/en/debug-your-config#check-common-causes)
