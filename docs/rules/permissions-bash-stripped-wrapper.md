---
type: Reference
description: The ESLint rule claude/permissions-bash-stripped-wrapper, which reports a Bash rule that starts with a wrapper that Claude Code strips before it matches, such as timeout, time, nice, nohup or stdbuf, because a rule for the inner command works.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-bash-stripped-wrapper`

Write a Bash rule for the inner command, not for a wrapper that Claude Code strips.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule is `off` in `recommended`. It is a heuristic, so `strict` turns it on at `warn`.
The rule also lints the managed settings files: `managed-settings.json` and each `managed-settings.d/*.json` drop-in.
It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

Before it matches Bash rules, Claude Code strips a fixed set of wrappers. So `Bash(npm test *)` also matches
`timeout 30 npm test`.[^wrappers] The stripped wrappers are `timeout`, `time`, `nice`, `nohup` and `stdbuf`. The shell builtins
`command` and `builtin` and the zsh `noglob` are stripped too. Bare `xargs` is stripped.[^wrappers]

The rule reports a `Bash` or `Monitor` rule in `allow`, `ask` or `deny` when the first word is one of these. The message tells
the person to write the rule for the inner command.

The rule is silent for these rules:

- `command -v`. It looks up a command and does not run one, so Claude Code does not strip it.[^wrappers]
- `xargs` with a flag, as `Bash(xargs -n1 grep *)`. Claude Code matches it as an `xargs` command, so a rule for `xargs` works.
  A rule that has only `xargs` and `*` is silent too, because the `*` can match a flag.[^wrappers]
- `nocorrect`, and the exec wrappers `watch`, `setsid`, `ionice` and `flock`. The docs do not list them as stripped.
  [`permissions-bash-exec-wrapper-prefix`](permissions-bash-exec-wrapper-prefix.md) reads the exec wrappers.
- Environment runners such as `devbox run`. [`permissions-bash-runner-wildcard`](permissions-bash-runner-wildcard.md) reads them.
- A `PowerShell` rule. The docs give the list for the Bash section.

The list is in `src/data/bash-commands.ts`, and `tests/bash-commands.test.ts` pins it to the sentence of the docs.

Fail:

```json
{ "permissions": { "allow": ["Bash(timeout 30 npm test)"] } }
```

Pass:

```json
{ "permissions": { "allow": ["Bash(npm test)"] } }
```

## Options

None.

## Sources

[^wrappers]: [Configure permissions: Wrappers](https://code.claude.com/docs/en/permissions#process-wrappers)
