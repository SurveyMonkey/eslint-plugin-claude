---
type: Reference
description: The ESLint rule claude/mcp-headershelper-path, which reports a headersHelper that starts with a relative path, because Claude Code runs the helper in a directory that depends on where the server is configured.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-headershelper-path`

Give a `headersHelper` an absolute path, or a command on `PATH`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.mcp.json`, `**/.claude-plugin/plugin.json` |

## Rule details

Claude Code runs a `headersHelper` in a shell. It picks the working directory from the place where
the server is configured: the plugin root for a plugin, the project directory for a project
`.mcp.json`, and the primary working directory or the configuration directory for other places.[^where]
The docs say to give the script as an absolute path or to put it on `PATH`.[^headers]

The rule reads the first word of the command. It reports a word that has a `/` and does not start
with `/`, `$` or `~`. So `./h.sh`, `../h.sh` and `scripts/h.sh` fail. The report is on the
`headersHelper` string. It reads these places:

- A `.mcp.json`, in a project and at the root of a plugin, with or without the `mcpServers` wrapper.
- The servers that `plugin.json` declares: the inline maps, and each `.json` file that `mcpServers`
  names. A report for a declared file is on the path in the manifest.

The rule leaves these cases alone:

- An absolute path, and a bare command such as `get-headers`.
- A first word that starts with `$` or `~`, such as `${CLAUDE_PLUGIN_ROOT}/h.sh`, `$HOME/h.sh` and
  `~/h.sh`. The shell expands them to a path that does not depend on the working directory.
- An inline command such as `echo '{...}'`. The first word is `echo`.
- A relative path that is not the first word, such as `bash ./h.sh`. The rule does not parse the shell.
- A `headersHelper` that is not a string.
- The `.mcp.json` at the plugin root, when the rule lints `plugin.json`. The rule reads that file as
  a file of its own, so a server gets one report.
- A path under `.claude/`, which `mcp-json-location` reports.

Of two `headersHelper` members in one entry, the last one counts.

Fail:

```json
{
  "mcpServers": {
    "internal-api": {
      "type": "http",
      "url": "https://mcp.internal.example.com",
      "headersHelper": "./scripts/get-headers.sh"
    }
  }
}
```

Pass:

```json
{
  "mcpServers": {
    "internal-api": {
      "type": "http",
      "url": "https://mcp.internal.example.com",
      "headersHelper": "/opt/bin/get-mcp-auth-headers.sh"
    }
  }
}
```

## Sources

[^headers]: [Connect Claude Code to tools via MCP: Use dynamic headers for custom authentication](https://code.claude.com/docs/en/mcp#use-dynamic-headers-for-custom-authentication)
[^where]: [Connect Claude Code to tools via MCP: Where the helper runs](https://code.claude.com/docs/en/mcp#where-the-helper-runs)
