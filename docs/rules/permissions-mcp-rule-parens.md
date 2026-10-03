---
type: Reference
description: The ESLint rule claude/permissions-mcp-rule-parens, which reports an mcp__ permission rule that has parentheses in a settings file, because Claude Code skips it.
owner: brianespinosa
created: 2026-10-01
related_issues: [15]
stale_after: 2027-03-29
generated:
  by: claude-code
  at: 2026-10-01T00:00:00Z
---

# `permissions-mcp-rule-parens`

Write an MCP permission rule without parentheses.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

## Rule details

When Claude Code loads a settings file, it skips each `mcp__` rule that has parentheses. It lists the skipped rule in the
invalid-settings dialog at the start of an interactive session, and in `claude doctor` output.[^param] An MCP rule has
the form `mcp__<server>`, `mcp__<server>__<tool>` or `mcp__<server>__*`.[^mcp] To match a parameter of an MCP tool, pass a deny
rule with `--disallowedTools`.

The rule reads each string in `permissions.allow`, `permissions.ask` and `permissions.deny`. It reports a rule whose tool
name starts with `mcp__` and that has parentheses, also empty ones.

The rule skips a string that does not parse. [`permissions-rule-syntax`](permissions-rule-syntax.md) reports it.

The docs state the skip for a settings file only, so the rule does not lint skill files (ruling 17).

Fail:

```json
{ "permissions": { "deny": ["mcp__github__create_issue(title:x)"] } }
```

Pass:

```json
{ "permissions": { "deny": ["mcp__github__create_issue"] } }
```

## Sources

[^param]: [Configure permissions: Match by input parameter](https://code.claude.com/docs/en/permissions#match-by-input-parameter)
[^mcp]: [Configure permissions: MCP](https://code.claude.com/docs/en/permissions#mcp)
