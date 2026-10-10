---
type: Reference
description: The ESLint rule claude/mcp-disable-connectors-false, which reports disableClaudeAiConnectors false in a managed settings file, because the value is the same as unset and cannot turn the connectors back on.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-disable-connectors-false`

Do not set `disableClaudeAiConnectors` to `false` in a managed settings file.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule lints the managed settings files: `managed-settings.json` and each
`managed-settings.d/*.json` drop-in. It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

The key `disableClaudeAiConnectors` turns off the claude.ai connectors that Claude Code fetches
itself. A `true` in any settings file applies. The value `false` is the same as unset: Claude Code
fetches the connectors unless another settings file or `ENABLE_CLAUDEAI_MCP_SERVERS` turns them
off.[^key] So a `false` cannot turn the connectors back on after a `true` in another scope.[^guide]
To turn the connectors off, set `true`. To leave them on, remove the key.

The rule reports a `false` value. The report is on the value. A value of another type gives no
report. When a file has two keys of one name, the rule reads the last, as `JSON.parse` does.

The rule `settings-project-value-ignored` reports the same value in `.claude/settings.json` and
`.claude/settings.local.json`. This rule reads the managed files only, so a `false` in a project
file gets one report.

Fail, in `managed-settings.json`:

```json
{
  "disableClaudeAiConnectors": false
}
```

Pass:

```json
{
  "disableClaudeAiConnectors": true
}
```

## Sources

[^key]: [All settings: disableClaudeAiConnectors](https://code.claude.com/docs/en/settings-reference#disableclaudeaiconnectors)
[^guide]: [Connect Claude Code to tools via MCP: Disable claude.ai connectors](https://code.claude.com/docs/en/mcp#disable-claude-ai-connectors)
