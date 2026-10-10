---
type: Reference
description: The ESLint rule claude/permissions-bash-colon-star-mid, which reports a Bash, Monitor or PowerShell rule with a :* before the end of the pattern, because the permissions page says Claude Code reads that colon as a literal character and the rule does not match as intended.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-bash-colon-star-mid`

Put the `:*` of a Bash rule at the end of the pattern.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule reads no hidden drop-in in `managed-settings.d`, because Claude Code ignores it.

## Rule details

The `:*` form is a way to write a final wildcard: `Bash(ls:*)` is the same as `Bash(ls *)`. Claude Code reads it at the end of a
pattern only. In a pattern such as `Bash(git:* push)`, the colon is a literal character, and the rule does not match git
commands.[^wildcards] The rule reports a `:*` that ends a word before the end of the pattern in `Bash`, `Monitor` and
`PowerShell` rules, in `allow`, `ask` and `deny`. The message tells you to put the wildcard at the end, after the
subcommand, as in `Bash(git push *)`.[^wildcards] The permissions page warns that a wildcard in the middle, as in
`Bash(git * main)`, matches more than you expect.[^wildcards]

The rule makes no report for a `:*` inside a word, as in `Bash(curl http://localhost:*/health)`, or for a lone `Bash(:*)`.
Both are text with a wildcard.

### The version split

The permissions page gives no version for this behavior, and the rule makes no report that depends on a version.
The [Claude Code `CHANGELOG.md`](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) says that v2.1.282 and later accept such a rule from every
source, and show a message at startup. The docs do not say so. The docs win, so the rule reports on every version.
A client before v2.1.282 skips such a rule in a settings file.

### One report for one fault

A `:*` at the end of a pattern is for [`permissions-bash-colon-star-suffix`](permissions-bash-colon-star-suffix.md). A rule such as
`Bash(git:* push:*)` has both faults and gets one report from each rule.

Fail:

```json
{
  "permissions": {
    "allow": ["Bash(git:* push)"]
  }
}
```

Pass:

```json
{
  "permissions": {
    "allow": ["Bash(git push *)"]
  }
}
```

## Options

None.

## Sources

[^wildcards]: [Configure permissions: Wildcard patterns](https://code.claude.com/docs/en/permissions#wildcard-patterns)
