---
type: Reference
description: The ESLint rule claude/permissions-bash-wildcard-before-subcommand, which reports an allow rule for Bash, Monitor or PowerShell with a * before the subcommand, such as Bash(git * main), because the * also matches the options at that position and approves them without a prompt.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-bash-wildcard-before-subcommand`

Put the `*` of a Bash allow rule after the subcommand.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | security | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule also lints the managed settings files: `managed-settings.json` and each `managed-settings.d/*.json` drop-in.
It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

A `*` in a Bash rule matches any text, with spaces. Claude Code matches everything before the first `*` as
written, so the words before it limit the rule.[^wildcards] In `git log --oneline main`, `git` is the program and `log`
is the subcommand. A `*` in the place of the subcommand matches every git subcommand and every option before it.
`Bash(git * main)` also approves `git -c core.fsmonitor=<script> diff main`, where `-c` makes git run a program.[^wildcards]
Claude Code warns about such an allow rule at startup, and it keeps the rule.[^warning]

The rule reports an `allow` entry for `Bash`, `Monitor` or `PowerShell` when a word that is a bare `*` has a word after
it, and one of these holds:

- The `*` is the first word, as in `Bash(* --version)`. It stands in for the program, so any program matches.[^wildcards]
- Only options sit between the program and the `*`, as in `Bash(git * main)` and `Bash(git -C * status *)`.

The rule does not report a `*` that comes after a word that is not an option. `Bash(git log * main)` is in the docs table
of rules that work as written.[^wildcards] A rule where the `*` is the last word, such as `Bash(git *)`, has no word after
it. A `:*` at the end is the same as a final ` *`, so `Bash(git:*)` is not a report.[^wildcards]

The rule cannot tell an option that takes a value from a subcommand. `Bash(docker -H host * ps)` has the word `host`
before the `*`, so the rule reads `host` as the subcommand and stays silent.

The rule reads the last of two keys of one name, as `JSON.parse` does. It reads `permissions.allow` of a settings file. It
reads no skill file, because the docs state the startup warning for settings files, managed settings and flags.[^warning]
The rule skips a string that does not parse. [`permissions-rule-syntax`](permissions-rule-syntax.md) reports it.

### One report for one fault

- A bare `Bash` and `Bash(*)` have no word after the `*`. [`permissions-allow-unrestricted`](permissions-allow-unrestricted.md)
  reports them.
- A `*` that is part of a word, as in `Bash(ls*)`, is not a bare `*`, so this rule leaves it alone. A `:*` in the middle
  of a pattern, as in `Bash(git:* push)`, is literal text to Claude Code. This rule leaves it alone too.
- A prefix rule for an environment runner or an exec wrapper is for
  [`permissions-bash-runner-wildcard`](permissions-bash-runner-wildcard.md) and
  [`permissions-bash-exec-wrapper-prefix`](permissions-bash-exec-wrapper-prefix.md). Their rules have no `*` before the
  last word.

Fail:

```json
{ "permissions": { "allow": ["Bash(git * main)", "Bash(git -C * status *)", "Bash(* --version)"] } }
```

Pass:

```json
{ "permissions": { "allow": ["Bash(git checkout main)", "Bash(git status *)", "Bash(git log * main)"] } }
```

## Options

None.

## Sources

[^wildcards]: [Configure permissions: Wildcard patterns](https://code.claude.com/docs/en/permissions#wildcard-patterns)
[^warning]: [Error reference: Has a wildcard before the rest of the command](https://code.claude.com/docs/en/errors#has-a-wildcard-before-the-rest-of-the-command)
