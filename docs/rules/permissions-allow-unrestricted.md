---
type: Reference
description: The ESLint rule claude/permissions-allow-unrestricted, which reports an allow rule for a bare Bash or PowerShell, for Bash(*) or PowerShell(*), and for WebFetch(domain:*), because each approves every command or fetch and the last also opens the sandbox network to any host.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-allow-unrestricted`

Do not allow every Bash or PowerShell command, or every WebFetch domain.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | security | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule also lints the managed settings files: `managed-settings.json` and each `managed-settings.d/*.json` drop-in.
It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

An allow rule lets Claude Code use the tool without manual approval.[^manage] A rule with no specifier matches all uses of
a tool, and `Bash(*)` is the same as `Bash`.[^all] `PowerShell` and `PowerShell(*)` match every command in the same
way.[^powershell] `WebFetch(domain:*)` matches every domain. Claude fetches without a prompt, and sandboxed commands can
reach any host.[^fetch]

The rule reports an `allow` entry that is one of these:

- `Bash` or `Bash(*)`
- `PowerShell` or `PowerShell(*)`
- `WebFetch(domain:*)`

The rule does not report a bare `WebFetch`. The docs show it as the way to let Claude fetch freely and keep the sandbox
allowlist as it is.[^fetch] The docs state the match-all form for `Bash` and `PowerShell`, so the rule does not report `Monitor`. It does not read
`deny` and `ask`, where the same rules block or prompt.

The rule reads the last of two keys of one name, as `JSON.parse` does. It reads `permissions.allow` of a settings file. It
skips a string that does not parse. [`permissions-rule-syntax`](permissions-rule-syntax.md) reports it.

### One report for one fault

- The rule reads settings files only. [`skill-allowed-tools-broad`](skill-allowed-tools-broad.md) reports a bare `Bash`,
  `Bash(*)`, `PowerShell`, `PowerShell(*)` and `WebFetch` in the `allowed-tools` of a skill.
- A tool-name glob such as `*` or `mcp__*` in `allow` is for [`permissions-tool-name-glob`](permissions-tool-name-glob.md).
  Claude Code skips it, and it approves nothing.
- [`permissions-bash-wildcard-before-subcommand`](permissions-bash-wildcard-before-subcommand.md) reports a `*` before the
  subcommand, as in `Bash(* --version)`. That rule matches any program, and not every command.

Fail:

```json
{ "permissions": { "allow": ["Bash", "WebFetch(domain:*)"] } }
```

Pass:

```json
{ "permissions": { "allow": ["Bash(npm test)", "WebFetch(domain:docs.example.com)"] } }
```

## Options

None.

## Sources

[^manage]: [Configure permissions: Manage permissions](https://code.claude.com/docs/en/permissions#manage-permissions)
[^all]: [Configure permissions: Match all uses of a tool](https://code.claude.com/docs/en/permissions#match-all-uses-of-a-tool)
[^powershell]: [Configure permissions: PowerShell](https://code.claude.com/docs/en/permissions#powershell)
[^fetch]: [Configure permissions: Allow or deny every fetch](https://code.claude.com/docs/en/permissions#allow-or-deny-every-fetch)
