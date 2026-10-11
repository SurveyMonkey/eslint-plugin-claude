---
type: Reference
description: The ESLint rule claude/sandbox-unsandboxed-retry, a heuristic that reports a settings file that turns the sandbox on when its source neither sets allowUnsandboxedCommands to false nor holds a rule for the dangerouslyDisableSandbox parameter, because Claude can then retry a blocked command outside the sandbox.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `sandbox-unsandboxed-retry`

Close the unsandboxed retry of Claude while the sandbox is on.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | security | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule is `off` in `recommended`. It is a heuristic, so `strict` turns it on at `warn`.

## Rule details

When the sandbox blocks a command, Claude can retry it with the `dangerouslyDisableSandbox` parameter. The retried command runs
outside the sandbox. In `bypassPermissions` mode it runs with no prompt, and a matching allow rule such as `Bash(curl *)`
approves it too.[^hatch] Two settings close the retry: `"allowUnsandboxedCommands": false`, and an ask rule for
`Bash(dangerouslyDisableSandbox:true)`.[^hatch][^strict] The default of `allowUnsandboxedCommands` is `true`.[^retry]
An ask rule prompts for the retry in auto mode and `bypassPermissions` mode too.[^hatch]

The rule reports a file that sets `sandbox.enabled` to `true` when neither setting is in its source. The report is on the `enabled`
value of the file. The other file of the pair, or of the managed source, does not report if it does not set `enabled`. A file
that sets `enabled` to `true` reports for itself. A `deny` rule for the parameter is the choice of the plugin: the docs
describe only the ask rule, and a deny rule stops the retry too.[^params] A `PowerShell` or `Monitor` rule counts as well as
a `Bash` rule. The value of the parameter is `true` or a wildcard.

### A minimal sandbox example reports

`{"sandbox": {"enabled": true}}` is the shape that the settings reference shows for `sandbox.enabled`. The rule reports it,
because the default of the retry is `true`, and the docs name the retry as an escape hatch. The managed example of the docs
(`enabled`, `failIfUnavailable`, `allowUnsandboxedCommands: false`) is silent.[^enforce] This is a heuristic. A team that wants
to keep the retry open on purpose leaves the rule off. An explicit `true` does not silence the rule.

### What the rule does not read

- A user settings file. It is outside the repository (ADR 001, Decision 14), and the docs say that a `false` in user
  settings holds against a project's `true`.[^strict] The rule is `off` in `recommended` for that reason.
- A source with a file that the rule cannot read. That file can hold either setting, so the rule gives no report.
- The permission mode. The retry can run with no prompt in `bypassPermissions` mode, and a classifier decides in auto
  mode.[^hatch]
- A managed value that is not a Boolean. Claude Code reads a quoted `"true"` or `"false"` as that Boolean. Any other invalid
  `enabled` counts as `true`, and any other invalid `allowUnsandboxedCommands` counts as `false`.[^invalid]

Fail:

```json
{ "sandbox": { "enabled": true } }
```

Pass:

```json
{ "sandbox": { "enabled": true, "allowUnsandboxedCommands": false } }
```

## Options

None.

## Sources

[^retry]: [All settings: sandbox.allowUnsandboxedCommands](https://code.claude.com/docs/en/settings-reference#sandbox-allowunsandboxedcommands)
[^hatch]: [Configure the sandboxed Bash tool: The unsandboxed retry escape hatch](https://code.claude.com/docs/en/sandboxing#the-unsandboxed-retry-escape-hatch)
[^strict]: [Configure the sandboxed Bash tool: Turn off the retry with strict sandbox mode](https://code.claude.com/docs/en/sandboxing#turn-off-the-retry-with-strict-sandbox-mode)
[^params]: [Permissions: Match by input parameter](https://code.claude.com/docs/en/permissions#match-by-input-parameter)
[^enforce]: [Configure the sandboxed Bash tool: Enforce sandboxing with managed settings](https://code.claude.com/docs/en/sandboxing#enforce-sandboxing-with-managed-settings)
[^invalid]: [Managed settings: Invalid values inside sandbox](https://code.claude.com/docs/en/managed-settings#invalid-values-inside-sandbox)
