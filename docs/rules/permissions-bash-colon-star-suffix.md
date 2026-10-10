---
type: Reference
description: The ESLint rule claude/permissions-bash-colon-star-suffix, which reports a Bash, Monitor or PowerShell rule that ends in :*, because it is the same as a final space and *, and the permission dialog writes the space form.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-bash-colon-star-suffix`

Write the final wildcard of a Bash rule as a space and `*`, not as `:*`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule reads no hidden drop-in in `managed-settings.d`, because Claude Code ignores it.

## Rule details

A `:*` at the end of a pattern is an equivalent way to write a final wildcard: `Bash(ls:*)` matches the same commands as
`Bash(ls *)`.[^wildcards] The permission dialog writes the space form when you select "Yes, and don't ask again" for a
command prefix.[^wildcards] `PowerShell` rules follow the same shape.[^powershell] The rule reports a `:*` at the end of a
`Bash`, `Monitor` or `PowerShell` pattern, in `allow`, `ask` and `deny`. The message gives the space form.

The two forms match the same commands, so the rule is a style rule. It makes one form of the rule in a repository, the form
that Claude Code writes itself.

A `:*` before the end of a pattern is for [`permissions-bash-colon-star-mid`](permissions-bash-colon-star-mid.md). A `:*` that
stands alone, as in `Bash(:*)`, is text and gets no report.

Fail:

```json
{
  "permissions": {
    "allow": ["Bash(ls:*)"]
  }
}
```

Pass:

```json
{
  "permissions": {
    "allow": ["Bash(ls *)"]
  }
}
```

## Options

None.

## Sources

[^wildcards]: [Configure permissions: Wildcard patterns](https://code.claude.com/docs/en/permissions#wildcard-patterns)
[^powershell]: [Configure permissions: PowerShell](https://code.claude.com/docs/en/permissions#powershell)
