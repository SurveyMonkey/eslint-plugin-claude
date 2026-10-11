---
type: Reference
description: The ESLint rule claude/hooks-handler-type-event-support, which reports a hook handler type that its event does not run, such as a prompt hook on SessionEnd, an http hook on SessionStart, an agent hook on PermissionRequest, or an mcp_tool hook that Claude Code skips at launch.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-handler-type-event-support`

Use a hook handler type that the event runs.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

Not every event runs all five handler types.[^types] Claude Code skips a hook of a type that its event does not
run. The rule reports at the `type` value of the handler. It reads the same files as
[`hooks-config-schema`](hooks-config-schema.md). It skips a handler with no `type` or an unknown `type`, and an
event that it does not know.

| Event | Runs | The rule reports |
|-------|------|------------------|
| `PermissionDenied`, `PostToolBatch`, `PostToolUse`, `PostToolUseFailure`, `PreToolUse`, `Stop`, `SubagentStop`, `TaskCompleted`, `TaskCreated`, `TeammateIdle`, `UserPromptExpansion`, `UserPromptSubmit` | All five types | A `prompt` or `agent` hook on `PermissionDenied` only (see below) |
| `PermissionRequest` | `command`, `http`, `mcp_tool`, `prompt` | `agent` |
| `ConfigChange`, `CwdChanged`, `DirectoryAdded`, `Elicitation`, `ElicitationResult`, `FileChanged`, `InstructionsLoaded`, `MessageDisplay`, `Notification`, `PostCompact`, `PostModelSwitch`, `PreCompact`, `PreModelSwitch`, `SessionEnd`, `StopFailure`, `SubagentStart`, `WorktreeCreate`, `WorktreeRemove` | `command`, `http`, `mcp_tool` | `prompt`, `agent` |
| `SessionStart` | `command`, `mcp_tool` | `http`, `prompt`, `agent` |
| `Setup` | `command` | `http`, `mcp_tool`, `prompt`, `agent` |

### Cases that the docs word with care

- **`mcp_tool` on `SessionStart`.** At launch, with `--continue` or `--resume` too, the MCP servers are not up
  yet, so Claude Code skips the hook.[^mcp] When `SessionStart` fires again, after `/clear` or a compaction, the
  hook runs. So the rule reports only a matcher that selects `startup` and `resume` and no other source, such as
  `startup`, `resume` or `startup|resume`. A match-all matcher (omitted, empty, or `*`) also fires on `clear`
  and `compact`, so the rule makes no report for it. It does not read a matcher that is a regular
  expression.
- **`mcp_tool` on `Setup`.** The prompt-based hooks page lists `mcp_tool` for `Setup`. The `Setup` section
  says that Claude Code always skips such a hook.[^setup] The rule follows the `Setup` section.
- **`agent` on `PermissionRequest`.** The hooks reference says that Claude Code skips the hook.[^types] The rule
  reports it.
- **`prompt` and `agent` on `PermissionDenied`.** The reference lists the event among those that run all five
  types. Claude Code runs a prompt or agent hook there and discards its output. The only output the event
  reads is `retry`, which these hooks cannot set.[^response] The rule reports such a hook with a message that
  says so.

The rule reads no hidden file in `managed-settings.d/`, and no plugin agent, because Claude Code ignores the
`hooks` field there.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionEnd": [{ "hooks": [{ "type": "prompt", "prompt": "Summarize the session." }] }]
  }
}
```

Pass:

```json
{
  "hooks": {
    "SessionEnd": [{ "hooks": [{ "type": "command", "command": "./scripts/cleanup.sh" }] }]
  }
}
```

## Sources

[^types]: [Hooks reference: Prompt-based hooks](https://code.claude.com/docs/en/hooks#prompt-based-hooks)
[^setup]: [Hooks reference: Setup decision control](https://code.claude.com/docs/en/hooks#setup-decision-control)
[^mcp]: [Hooks reference: Events that fire before MCP servers are available](https://code.claude.com/docs/en/hooks#events-that-fire-before-mcp-servers-are-available)
[^response]: [Hooks reference: Response schema](https://code.claude.com/docs/en/hooks#response-schema)
