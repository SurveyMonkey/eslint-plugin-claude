---
type: Reference
description: The ESLint rule claude/mcp-project-toggle-keys, which reports disabledMcpServers and enabledMcpServers in a settings file, because Claude Code stores these lists per project in ~/.claude.json and the settings reference lists no such key.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-project-toggle-keys`

Do not set `disabledMcpServers` or `enabledMcpServers` in a settings file.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule is `off` in `recommended`. It is a heuristic.

## Rule details

When a person toggles a server in the `/mcp` panel, Claude Code records the choice for the
project in `~/.claude.json`. It uses two lists: `disabledMcpServers` and `enabledMcpServers`.[^toggle]
The settings reference lists neither as a settings key.

The two lists are not the settings `disabledMcpjsonServers` and `enabledMcpjsonServers`. Those
settings approve or block the servers of a project `.mcp.json`.[^enabled][^disabled]

The rule reports each of the two keys at the top level of a settings file. The report is on the
key. The docs do not say that Claude Code ignores the key in a settings file. They say where Claude
Code stores the lists. So the message states that, and names the approval settings.

The rule does not report these cases:

- `disabledMcpjsonServers` and `enabledMcpjsonServers`.
- A key of the same name below the top level, such as in `env` or `permissions`.
- A hidden file in `managed-settings.d`. Claude Code ignores it.

Of two keys with one name, the last one counts, as `JSON.parse` keeps it.

Fail:

```json
{
  "disabledMcpServers": ["github"]
}
```

Pass:

```json
{
  "disabledMcpjsonServers": ["github"]
}
```

## Sources

[^toggle]: [Connect Claude Code to tools via MCP: Disable a server without removing it](https://code.claude.com/docs/en/mcp#disable-a-server-without-removing-it)
[^enabled]: [All settings: enabledMcpjsonServers](https://code.claude.com/docs/en/settings-reference#enabledmcpjsonservers)
[^disabled]: [All settings: disabledMcpjsonServers](https://code.claude.com/docs/en/settings-reference#disabledmcpjsonservers)
