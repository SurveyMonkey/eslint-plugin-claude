---
type: Reference
description: The ESLint rule claude/permissions-bash-exec-wrapper-prefix, which reports a prefix allow rule for watch, setsid, ionice or flock, such as Bash(watch *), because a prefix rule cannot auto-approve these exec wrappers and only an exact-match rule works.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-bash-exec-wrapper-prefix`

Write an exact Bash allow rule for an exec wrapper such as `watch`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule also lints the managed settings files: `managed-settings.json` and each `managed-settings.d/*.json` drop-in.
It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

Exec wrappers such as `watch`, `setsid`, `ionice` and `flock` cannot be auto-approved by a prefix rule like
`Bash(watch *)`. In Manual mode they always prompt.[^wrappers] To approve one invocation, write an exact-match rule for the
full command string.[^wrappers] A prefix rule for a wrapper is a no-op.

The rule reports an `allow` entry for `Bash` or `Monitor` when its first word is `watch`, `setsid`, `ionice` or
`flock`, and its last word is `*`. The `:*` suffix counts as a final ` *`.[^wildcards] `Monitor` uses the permission
rules of Bash.[^monitor] The rule does not read `PowerShell`, because the docs state the note in the Bash section.

The rule is silent for these rules:

- An exact-match rule, as in `Bash(watch -n 5 git status)`. The docs name it as the way to approve a wrapper.
- A rule with a `*` in the middle, such as `Bash(watch * ls)`. It is not a prefix rule, and the docs do not say what
  Claude Code does with it.
- A rule for a wrapper that Claude Code strips, such as `Bash(nice *)`. The stripped wrappers are `timeout`, `time`,
  `nice`, `nohup` and `stdbuf`.[^wrappers]
- `Bash(find *)`. The same paragraph says that a `find *` rule does not cover `find` with `-exec` or `-delete`.[^wrappers]
  The rule still approves plain `find`, so it is not a no-op. This rule leaves it alone.

The rule reads the last of two keys of one name, as `JSON.parse` does. It reads `permissions.allow` of a settings file. It
reads no skill file. The rule skips a string that does not parse.
[`permissions-rule-syntax`](permissions-rule-syntax.md) reports it.

### One report for one fault

- [`permissions-bash-runner-wildcard`](permissions-bash-runner-wildcard.md) reports prefix rules for environment runners such
  as `devbox run`. Those rules do work, and they approve too much. This rule reports rules that do not work.
- [`permissions-bash-wildcard-before-subcommand`](permissions-bash-wildcard-before-subcommand.md) reports a `*` before the
  last word. This rule reads a `*` in the last place only.

Fail:

```json
{ "permissions": { "allow": ["Bash(watch *)", "Bash(flock /tmp/lock *)"] } }
```

Pass:

```json
{ "permissions": { "allow": ["Bash(watch -n 5 git status)"] } }
```

## Options

None.

## Sources

[^wrappers]: [Configure permissions: Wrappers](https://code.claude.com/docs/en/permissions#process-wrappers)
[^wildcards]: [Configure permissions: Wildcard patterns](https://code.claude.com/docs/en/permissions#wildcard-patterns)
[^monitor]: [Tools reference: Monitor tool](https://code.claude.com/docs/en/tools-reference#monitor-tool)
