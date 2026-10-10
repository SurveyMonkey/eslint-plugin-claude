---
type: Reference
description: The ESLint rule claude/hooks-broad-auto-approve, which reports a hook whose inline command allows every tool call, or sets the permission mode to bypassPermissions.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-broad-auto-approve`

Do not auto-approve every tool or set bypassPermissions in a hook.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | security | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

A hook can answer a permission prompt. A `PermissionRequest` hook returns `decision.behavior: "allow"`.[^request]
A `PreToolUse` hook returns `permissionDecision: "allow"`, which skips the permission prompt.[^pretool] The hooks
guide says to keep the matcher as narrow as possible. A matcher of `.*`, or no matcher, auto-approves every tool
permission prompt, including file writes and shell commands.[^guide] A `setMode` entry in `updatedPermissions`
can change the permission mode, and `bypassPermissions` is one of the modes.[^update]

The output of a script is not in the file. So the rule reads the JSON text that the inline `command` or an `args`
item holds, as in the example of the guide (`echo '{"hookSpecificOutput": ...}'`). It ignores quotes,
backslashes and white space in that text. It reports two faults, at the `command` string:

- `allow`: a `PermissionRequest` handler with `behavior: "allow"`, or a `PreToolUse` handler with
  `permissionDecision: "allow"`, in a group with no matcher, an empty matcher, `*` or `.*`.
- `bypass`: text that holds `setMode` and `mode: "bypassPermissions"`, under any matcher and on any event. The
  rule does not check that both are in one entry. The docs say
  that the update takes effect only when the session already allows the mode. The rule cannot see that, so it
  reports the entry.

A handler that reports `bypass` gets no second `allow` report. A handler with an `if` condition is narrow, and gets
no `allow` report. A script file is out of scope.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, and no plugin agent.

Fail, in `~/.claude/settings.json` or a project settings file:

```json
{
  "hooks": {
    "PermissionRequest": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo '{\"hookSpecificOutput\": {\"hookEventName\": \"PermissionRequest\", \"decision\": {\"behavior\": \"allow\"}}}'"
          }
        ]
      }
    ]
  }
}
```

Pass: the same hook with `"matcher": "ExitPlanMode"` on the group.

## Sources

[^request]: [Hooks reference: PermissionRequest decision control](https://code.claude.com/docs/en/hooks#permissionrequest-decision-control)
[^pretool]: [Hooks reference: PreToolUse decision control](https://code.claude.com/docs/en/hooks#pretooluse-decision-control)
[^update]: [Hooks reference: Permission update entries](https://code.claude.com/docs/en/hooks#permission-update-entries)
[^guide]: [Hooks guide: Auto-approve specific permission prompts](https://code.claude.com/docs/en/hooks-guide#auto-approve-specific-permission-prompts)
