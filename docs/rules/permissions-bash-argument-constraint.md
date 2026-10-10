---
type: Reference
description: The ESLint rule claude/permissions-bash-argument-constraint, which reports a Bash allow rule that limits curl or wget to a URL, such as Bash(curl http://github.com/ *), because the rule misses other forms of the same call.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-bash-argument-constraint`

Do not limit `curl` or `wget` to a URL with a Bash allow rule.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | security | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule is `off` in `recommended`. It is a heuristic, so `strict` turns it on at `warn`.
The rule also lints the managed settings files: `managed-settings.json` and each `managed-settings.d/*.json` drop-in.
It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

A Bash rule that tries to constrain the arguments of a command is fragile. `Bash(curl http://github.com/ *)` does not match an
option before the URL, another protocol, a redirect, or a variable.[^read-only] The docs advise a deny rule for `curl`, `wget` and
similar commands, and a `WebFetch(domain:github.com)` rule for the allowed domains. They say to pair the deny rule with the
sandbox network allowlist when the limit must hold.[^read-only]

The rule reports an `allow` entry for `Bash`, `Monitor` or `PowerShell`. The first word is `curl` or `wget`, and a later word has
`://`. The message names the host of the URL, and gives the deny rule and the `WebFetch` rule.

The docs show URLs as the fault. The inventory row says "URLs or arguments". The rule checks URLs only, because the docs give no
other argument as an example. A rule such as `Bash(npm run build)` is silent.

The rule is silent for a `deny` or `ask` rule, for a rule with no URL, and for a program other than `curl` and `wget`.

The list is in `src/data/bash-commands.ts`, and `tests/bash-commands.test.ts` pins it to the sentence of the docs.

Fail:

```json
{ "permissions": { "allow": ["Bash(curl http://github.com/ *)"] } }
```

Pass:

```json
{ "permissions": { "allow": ["WebFetch(domain:github.com)"], "deny": ["Bash(curl *)", "Bash(wget *)"] } }
```

## Options

None.

## Sources

[^read-only]: [Configure permissions: Read-only commands](https://code.claude.com/docs/en/permissions#read-only-commands)
