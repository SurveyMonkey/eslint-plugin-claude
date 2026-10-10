---
type: Reference
description: The ESLint rule claude/permissions-bash-glued-wildcard, which reports a Bash allow rule with a program name and a * with no space, such as Bash(ls*), because it also matches longer program names such as lsof.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-bash-glued-wildcard`

Put a space before the final `*` of a Bash allow rule.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | security | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule is `off` in `recommended`. It is a heuristic, so `strict` turns it on at `warn`.
The rule also lints the managed settings files: `managed-settings.json` and each `managed-settings.d/*.json` drop-in.
It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

The space before a trailing `*` is part of the rule. `Bash(ls *)` needs a space after `ls`, so `lsof` does not match. `Bash(ls*)`
has no space, so it matches `lsof` too.[^wildcards]

The rule reports an `allow` entry for `Bash`, `Monitor` or `PowerShell`. The entry is one word and a final `*`.
The word has no space, `/`, `:` or backslash, as in `Bash(ls*)` or `Bash(git*)`. The message gives the rule with the space.

The rule is silent for these rules:

- A rule with a space, as `Bash(ls *)`, and the `:*` suffix, as `Bash(ls:*)`. Both need a space or a colon after the name.
- A `*` after more than the program, as `Bash(npm run test*)`. A person can mean a prefix there, such as `test:unit`.
  The docs show the fault for the program name only.
- A word that ends in a hyphen, as `PowerShell(Get-*)`. It names a family of commands and not a prefix of a program name.
- A path glob, as `Bash(./scripts/*)`. A `/` in the word makes it a path.
- A `deny` or `ask` rule. A wider match there only blocks or asks for more.

### One report for one fault

- [`permissions-bash-colon-star-suffix`](permissions-bash-colon-star-suffix.md) reports a `:*` at the end of a pattern. This rule
  reads a `*` glued to the program name and no colon.
- [`permissions-bash-wildcard-before-subcommand`](permissions-bash-wildcard-before-subcommand.md) reports a bare `*` word before
  the subcommand. This rule reads a `*` that is part of the first word.

Fail:

```json
{ "permissions": { "allow": ["Bash(ls*)"] } }
```

Pass:

```json
{ "permissions": { "allow": ["Bash(ls *)"] } }
```

## Options

None.

## Sources

[^wildcards]: [Configure permissions: Wildcard patterns](https://code.claude.com/docs/en/permissions#wildcard-patterns)
