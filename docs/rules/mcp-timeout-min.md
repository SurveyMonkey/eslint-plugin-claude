---
type: Reference
description: The ESLint rule claude/mcp-timeout-min, which reports a per-server MCP timeout below 1000 milliseconds, such as seconds written as 60, because Claude Code ignores it, with the min option.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-timeout-min`

Write the `timeout` of an MCP server in milliseconds, at 1000 or more.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.mcp.json` |

## Rule details

The `timeout` field of a server in `.mcp.json` is a number of milliseconds. It sets a hard limit on
one tool call, for that server only. Claude Code ignores a value below 1000. The server then falls
back to `MCP_TOOL_TIMEOUT`, or to its default of about 28 hours when that variable is unset.[^timeout]

A value such as `60`, written as seconds, is the usual cause. The rule reports a `timeout` that is
a number below `min`. The report is on the number. A value of 0 or less is below the minimum too.

The rule leaves these cases alone:

- A `timeout` that is not a number. The docs say nothing about a string.
- A `timeout` key in `env`, `oauth` or any other object. Only the key of the server counts.
- The value of `MCP_TOOL_TIMEOUT`. It is an `env` variable of settings, not a key of `.mcp.json`.

The rule reads the `mcpServers` object. A plugin `.mcp.json` may omit that wrapper. Then the
rule reads the top-level entries of the file. A directory
counts as a plugin root when it holds `.claude-plugin/plugin.json`. The rule makes no report when
it cannot read that directory. It skips the paths under `.claude/`, which `mcp-json-location`
reports.

Fail:

```json
{
  "mcpServers": {
    "build": { "command": "build-mcp", "timeout": 60 }
  }
}
```

Pass:

```json
{
  "mcpServers": {
    "build": { "command": "build-mcp", "timeout": 60000 }
  }
}
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `min` | `1000` | The least `timeout` in milliseconds. An integer of 1000 or more. Optional. |

```js
'claude/mcp-timeout-min': ['error', { min: 5000 }]
```

The default is the number in the docs.[^timeout] The schema sets 1000 as the minimum, because no
Claude Code setting moves that number. A team can set a higher value. A config that sets only the
severity keeps the default. The `recommended` and `strict` configs set no option.

At the default, the message says that Claude Code ignores a value below 1000. At another value,
the message says "The configured minimum is 5000 milliseconds", and it does not say what the docs
allow.

## Sources

[^timeout]: [Connect Claude Code to tools via MCP: Push messages with channels](https://code.claude.com/docs/en/mcp#push-messages-with-channels)
