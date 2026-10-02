---
type: Reference
description: The ESLint rule claude/permissions-unknown-tool, which reports a permission rule that names a tool Claude Code does not know, such as a transcript label or a name in the wrong case, because the rule never matches.
owner: brianespinosa
created: 2026-10-01
related_issues: [15]
stale_after: 2027-03-29
generated:
  by: claude-code
  at: 2026-10-01T00:00:00Z
---

# `permissions-unknown-tool`

Name a tool that Claude Code knows in a permission rule.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

## Rule details

A permission rule names a tool by its canonical name.[^tools] The name is case-sensitive. A rule for another name
never matches a tool. The label that the transcript shows can differ from the canonical name. The label
`Stop Task` is the tool `TaskStop`, and a rule written as `Stop Task` does not match.[^wildcards]

The rule reads the tool name of each rule in `permissions.allow`, `permissions.ask` and `permissions.deny`. It
accepts the 46 tools of the tools table, the old name `Task` of `Agent`, the legacy tool `MultiEdit`, and `Cd`, the rule
name of the `/cd` command.[^read][^cd] The list is in `src/data/tool-names.ts`, as of Claude Code 2.1.287.

The docs exempt a name that holds `_` or `*` from their own check for a deny or ask rule, and so does this rule.[^wildcards] This
covers each `mcp__` name and each glob. The docs state that check for deny and ask rules only. The rule also reads allow rules,
because a name that is not a tool never matches in any list. A name with the wrong case gets a report that names the correct
tool. It has no suggestion, because a rename changes what a rule matches.

The rule skips a string that does not parse. [`permissions-rule-syntax`](permissions-rule-syntax.md) reports it.

Fail:

```json
{ "permissions": { "deny": ["Stop Task", "bash(rm *)"] } }
```

Pass:

```json
{ "permissions": { "deny": ["TaskStop", "Bash(rm *)"] } }
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `additionalTools` | `[]` | Tool names to accept that are not in the list yet, for a Claude Code release newer than the list. |

```js
'claude/permissions-unknown-tool': ['error', { additionalTools: ['NewTool'] }]
```

## Sources

[^tools]: [Tools reference: Configure tools with permission rules and hooks](https://code.claude.com/docs/en/tools-reference#configure-tools-with-permission-rules-and-hooks)
[^wildcards]: [Configure permissions: Tool name wildcards](https://code.claude.com/docs/en/permissions#tool-name-wildcards)
[^read]: [Configure permissions: Read and Edit](https://code.claude.com/docs/en/permissions#read-and-edit)
[^cd]: [Configure permissions: Cd](https://code.claude.com/docs/en/permissions#cd)
