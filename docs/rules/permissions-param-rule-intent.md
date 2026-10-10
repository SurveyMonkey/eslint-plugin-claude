---
type: Reference
description: The ESLint rule claude/permissions-param-rule-intent, which reports a Tool(param:value) rule in allow, such as Agent(model:opus), because an allow rule keeps the specifier syntax of its tool and is not a parameter match.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-param-rule-intent`

Write a parameter rule in `deny` or `ask`, not in `allow`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule is `off` in `recommended`. It is a heuristic, so `strict` turns it on at `warn`.
The rule also lints the managed settings files: `managed-settings.json` and each `managed-settings.d/*.json` drop-in.
It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

Deny and ask rules can match a top-level input parameter with `Tool(param:value)`. An allow rule for one parameter value would not
show that the call is safe, so allow rules keep the specifier syntax of each tool.[^param] So `Agent(model:opus)` in `allow`
is not a parameter match.

The rule reports an `allow` entry whose specifier starts with a parameter name from this list: `model` and `isolation`
for `Agent`, `skill` for `Skill`, and `run_in_background`, `description`, `timeout` and `dangerouslyDisableSandbox` for the command
tools. The page names `run_in_background` and says the match works for any scalar parameter. The sandboxing and tools pages
show `dangerouslyDisableSandbox`, `timeout` and `run_in_background` as inputs of Bash. `description` is the choice of the
plugin. The plugin also applies the four names to `Monitor` and `PowerShell` rules, because the docs list no inputs for those
tools. Space around the colon does not matter.[^param]

Issue 15 has a second part: `Agent(model:...)` with an alias where a full ID is sent, or the reverse. The rule drops it.
The docs say only that the value is compared with the literal input, so `Agent(model:opus)` matches the alias and not a full model
ID.[^param] No file shows which form Claude sends, so a report would rest on a guess.

### One report for one fault

- [`permissions-param-rule`](permissions-param-rule.md) reports a parameter rule in `deny` or `ask` on the primary field of a tool.
  This rule reads `allow` and the named parameters only.
- [`permissions-bash-colon-star-suffix`](permissions-bash-colon-star-suffix.md) and
  [`permissions-bash-colon-star-mid`](permissions-bash-colon-star-mid.md) report a `:*` in a command rule, so this rule is silent for
  `Bash(run_in_background:*)`.
- [`permissions-dead-allow`](permissions-dead-allow.md) reports an allow rule with the same text as a deny or ask rule, or with a
  deny or ask rule for the bare tool. This rule is silent for it.

Fail:

```json
{ "permissions": { "allow": ["Agent(model:opus)"] } }
```

Pass:

```json
{ "permissions": { "ask": ["Agent(model:opus)"] } }
```

## Options

None.

## Sources

[^param]: [Configure permissions: Match by input parameter](https://code.claude.com/docs/en/permissions#match-by-input-parameter)
