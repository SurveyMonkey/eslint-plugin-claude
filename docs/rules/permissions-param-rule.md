---
type: Reference
description: The ESLint rule claude/permissions-param-rule, which reports a deny or ask rule in the form Tool(param:value) that names the primary input field of the tool, such as command for Bash, because Claude Code ignores it.
owner: brianespinosa
created: 2026-10-01
related_issues: [15]
stale_after: 2027-03-29
generated:
  by: claude-code
  at: 2026-10-01T00:00:00Z
---

# `permissions-param-rule`

Do not match the primary input field of a tool with a parameter rule.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

## Rule details

A deny or ask rule can match a top-level input parameter of a built-in tool with `Tool(param:value)`. A rule cannot match the
primary content field of a tool. These are the primary fields:

- `command` for Bash and PowerShell
- `file_path` for Read, Edit and Write
- `path` for Grep and Glob
- `notebook_path` for NotebookEdit
- `url` for WebFetch

Claude Code ignores such a rule and warns at startup. The docs give the replacement: `Bash(rm *)`, `Read(./path)` or
`WebFetch(domain:host)`.[^param] Space around the colon does not matter.

The rule reads `permissions.ask` and `permissions.deny`. It reports a rule whose parameter is the primary field of its own tool.
It does not read `permissions.allow`, because an allow rule uses the specifier of its tool.

The docs say that a rule names one parameter, and that a nested field is not matchable. They do not give a form for either fault,
so the rule does not report them.

The rule skips a string that does not parse. [`permissions-rule-syntax`](permissions-rule-syntax.md) reports it.

Fail:

```json
{ "permissions": { "deny": ["Bash(command:rm *)"] } }
```

Pass:

```json
{ "permissions": { "deny": ["Bash(rm *)", "Agent(model:opus)"] } }
```

## Sources

[^param]: [Configure permissions: Match by input parameter](https://code.claude.com/docs/en/permissions#match-by-input-parameter)
