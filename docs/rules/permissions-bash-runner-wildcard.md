---
type: Reference
description: The ESLint rule claude/permissions-bash-runner-wildcard, which reports an allow rule that ends in * after an environment runner such as devbox run or npx, because the rule approves any command that the runner starts, with the runners option.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-bash-runner-wildcard`

Write one Bash allow rule for each inner command of an environment runner.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | security | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule also lints the managed settings files: `managed-settings.json` and each `managed-settings.d/*.json` drop-in.
It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

Claude Code strips a fixed list of wrappers before it matches a Bash rule. The list is built in. It has no environment
runner such as `direnv exec`, `devbox run`, `mise exec`, `npx` or `docker exec`.[^wrappers] These tools run their
arguments as a command. A rule such as `Bash(devbox run *)` matches whatever comes after `run`, including
`devbox run rm -rf .`.[^wrappers] The docs give the fix: one rule for each inner command, as in `Bash(devbox run npm test)`.[^wrappers]

The rule reports an `allow` entry for `Bash` or `Monitor` with a runner and then a final `*`:

- `Bash(devbox run *)` and `Bash(npx *)`
- `Bash(direnv exec *)`, `Bash(mise exec *)` and `Bash(docker exec *)`
- the `:*` form of each, as in `Bash(npx:*)`, which is the same as a final ` *`[^wildcards]

`Monitor` uses the permission rules of Bash.[^monitor] The rule does not read `PowerShell`, because the docs state the
runner note in the Bash section.

The rule reports the form `<runner> *` only. A rule with more words before the `*` is silent, as in
`Bash(devbox run npm *)`. It names the inner program. A rule such as `Bash(direnv exec . *)` or
`Bash(docker exec my-container *)` also approves any inner command. The rule cannot tell an argument of the runner from
the inner command, so it does not report them.

The rule reads the last of two keys of one name, as `JSON.parse` does. It reads `permissions.allow` of a settings file. It
reads no skill file. The rule skips a string that does not parse.
[`permissions-rule-syntax`](permissions-rule-syntax.md) reports it.

### One report for one fault

- [`permissions-bash-wildcard-before-subcommand`](permissions-bash-wildcard-before-subcommand.md) reports a `*` before the
  last word. This rule reads a `*` in the last place only.
- [`permissions-bash-exec-wrapper-prefix`](permissions-bash-exec-wrapper-prefix.md) reports prefix rules for `watch`,
  `setsid`, `ionice` and `flock`. Those are exec wrappers, and not runners.
- A wrapper that Claude Code strips, such as `timeout` or `nice`, is not a runner. The rule does not read it.

Fail:

```json
{ "permissions": { "allow": ["Bash(devbox run *)", "Bash(npx *)"] } }
```

Pass:

```json
{ "permissions": { "allow": ["Bash(devbox run npm test)", "Bash(npx prettier --check *)"] } }
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `runners` | `["direnv exec", "devbox run", "mise exec", "npx", "docker exec"]` | The runners to check. Each is the words of the runner, as in `"devbox run"`. The list replaces the default. |

```js
"claude/permissions-bash-runner-wildcard": ["error", { runners: ["npx", "task run"] }]
```

The default list is the list in the docs. A runner that you add is your own choice. The message does not say that the docs
name it.

## Sources

[^wrappers]: [Configure permissions: Wrappers](https://code.claude.com/docs/en/permissions#process-wrappers)
[^wildcards]: [Configure permissions: Wildcard patterns](https://code.claude.com/docs/en/permissions#wildcard-patterns)
[^monitor]: [Tools reference: Monitor tool](https://code.claude.com/docs/en/tools-reference#monitor-tool)
