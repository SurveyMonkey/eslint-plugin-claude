---
type: Reference
description: The ESLint rule claude/permissions-cd-allowlist, which reports a Cd allow rule once for each settings file, because any Cd allow rule switches the /cd command to allowlist mode and /cd refuses each target that no allow rule matches.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-cd-allowlist`

Add a `Cd` `allow` rule only to put `/cd` in allowlist mode.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule reads no hidden drop-in in `managed-settings.d`, because Claude Code ignores it.

## Rule details

`Cd` rules control which directories the `/cd` command can move the session to.[^cd] Adding any `Cd` allow rule switches
`/cd` to allowlist mode: the resolved target directory must match one of the allow rules, or `/cd` refuses.[^cd] With no `Cd`
rules, `/cd` keeps its default behavior.[^cd]

The rule makes one report for a file, at the first `Cd` rule in `allow`. The message gives the number of allow rules when
the file has more than one. A bare `Cd` and a `Cd(<path>)` rule both count. A person who writes one `Cd` allow rule
can expect it to add a target, and the rule asks that the allowlist mode be deliberate.

The rule reads each file alone. It reads no `deny` or `ask` rule, and it does not read the other file of the project pair.
Two files that each hold a `Cd` allow rule give two reports.

Fail:

```json
{ "permissions": { "allow": ["Cd(~/code/**)", "Cd(~/work/**)"] } }
```

Pass:

```json
{ "permissions": { "deny": ["Cd(~/private/**)"] } }
```

## Options

None.

## Sources

[^cd]: [Configure permissions: Cd](https://code.claude.com/docs/en/permissions#cd)
