---
type: Reference
description: The ESLint rule claude/permissions-bash-deny-not-boundary, which reports a Bash deny or ask rule, or a Read deny rule, in a settings source that turns on no sandbox and holds no PreToolUse hook, because the rule stops one form of a command or file and no other.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-bash-deny-not-boundary`

Do not rely on a Bash or Read deny rule as a security boundary.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | security | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule is `off` in `recommended`. It is a heuristic, so `strict` turns it on at `warn`.
The rule also lints the managed settings files: `managed-settings.json` and each `managed-settings.d/*.json` drop-in.
It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

A Bash rule matches the command text that Claude writes. It does not match the same program in another form, so a `deny` or
`ask` rule is not a security boundary.[^limits] `Bash(rm *)` stops `rm -rf build/`. It does not stop `/bin/rm -rf build/` or
`bash -c 'rm -rf build/'`.[^limits][^debug] A `Read` or `Edit` deny rule does not apply to a command that reads files without
naming them, such as `grep -r pattern .`, or to a subprocess that opens files itself.[^read][^deny] For a hard guarantee, the docs
name the sandbox and a `PreToolUse` hook.[^debug][^limits]

The rule makes one report for a file, at its first such rule. It counts a `Bash` or `Monitor` rule in `deny` or `ask`, and a
`Read` rule in `deny`. It does not count a bare tool rule, a `Bash(*)` rule, or a parameter rule such as
`Bash(run_in_background:true)`, because they make no claim about one command or file.

The rule reads one settings source. For a project file, the source is `settings.json` and `settings.local.json`. For a managed
file, it is the merged `managed-settings.json` and `managed-settings.d/*.json` files. The two sources never mix.
The rule is silent in these cases:

- A file of the source sets `sandbox.enabled` to `true`. In a managed file, the string `"true"` counts too.
- A file of the source holds a `hooks.PreToolUse` key that is not an empty list.
- The rule cannot read a file of the source. That file can hold the sandbox or a hook.

### Limits

The rule reads settings files in the repository only. A hook in a user file, in a plugin `hooks/hooks.json`, or in the front
matter of a skill or an agent is not visible to it. A user file can turn on the sandbox too. So the rule can report a project that
one of these protects. That is the reason the rule is `off` in `recommended`.

Fail:

```json
{ "permissions": { "deny": ["Bash(rm *)"] } }
```

Pass:

```json
{ "permissions": { "deny": ["Bash(rm *)"] }, "sandbox": { "enabled": true } }
```

## Options

None.

## Sources

[^limits]: [Configure permissions: What a Bash rule doesn't match](https://code.claude.com/docs/en/permissions#bash-rule-limits)
[^deny]: [All settings: permissions.deny](https://code.claude.com/docs/en/settings-reference#permissionsdeny)
[^read]: [Configure permissions: Read and Edit](https://code.claude.com/docs/en/permissions#read-and-edit)
[^debug]: [Debug your configuration: Check common causes](https://code.claude.com/docs/en/debug-your-config#check-common-causes)
