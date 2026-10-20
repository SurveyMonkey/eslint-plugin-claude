---
type: Reference
description: The ESLint rule claude/mcp-server-schema, which reports a server entry of a project .mcp.json or a committed managed-mcp.json that Claude Code skips for its shape, such as a url with no type or an args value that is not an array of strings. In a plugin, it reports a url with a command and no type only, except at a repository root with no manifest.
owner: brianespinosa
created: 2026-10-17
related_issues: [16, 355]
stale_after: 2027-04-17
generated:
  by: claude-code
  at: 2026-10-17T19:50:00Z
---

# claude/mcp-server-schema

📝 Give each MCP server entry the shape that Claude Code loads.

💼 This rule is enabled in the following configs: ✅ `recommended`, 🔒 `strict`.

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| load | `**/.mcp.json`, `**/managed-mcp.json`, `**/.claude-plugin/plugin.json` |

## Rule details

Claude Code skips a malformed entry of `.mcp.json`, and loads the other servers.[^quickstart]
Claude Code reads an entry with no `type` as a stdio server. So it skips an entry that has a `url`
and no `type`.[^http] For a stdio server, `command` and `args` are the program to run. For an HTTP
server, `url` is the endpoint.[^edit]

The rule reports these faults of a server entry:

- The entry is not an object. The report is on the entry.
- The entry has a `url` and no `type`. The report is on the `url` value. A `url` of `null` counts
  as no `url`.
- The `type` is not `stdio`, `http`, `streamable-http`, `sse` or `ws`. The report is on the `type`
  value. The value is case-sensitive, and a value that is not a string is unknown too.
- A stdio entry has no `command`. The report is on the entry.
- The `command` of a stdio entry is not a string. The report is on the `command` value.
- The `args` of a stdio entry is not an array. The report is on the `args` value. An entry with no
  `args` is valid.
- An item of `args` is not a string. The report is on each such item.
- A remote entry has no `url`. The report is on the `type` value.
- The `url` of a remote entry is not a string, or is not a valid absolute URL. The report is on the
  `url` value.

A stdio entry has the `type` `stdio`, or no `type`. A remote entry has the `type` `http`,
`streamable-http`, `sse` or `ws`. An entry with no `type` and a `url` gets one report only.
An entry with an unknown `type` gets one report only.

The rule reads the `mcpServers` object of a project `.mcp.json` and of a committed
`managed-mcp.json`. It reads a `managed-mcp.json` in a plugin root too. A plugin has no such
component, and `claude plugin validate` 2.1.302 does not read the file. Of two members with one
name, the last one counts, as `JSON.parse` keeps it.

In a plugin, the rule reports one fault only: a `url` with no `type`, in an entry with a good stdio
shape. That entry has a `command` that is not empty, and `args` of strings. `claude plugin
validate` 2.1.302 passes that entry, but Claude Code skips it.[^http] Validate reports each other
fault that makes Claude Code drop a plugin entry at load. It also reports a remote `url` that is
not a valid absolute URL.[^validate] [^plugin] The rule reads a plugin `.mcp.json`, and the inline servers of
`plugin.json`. It also reads the servers of each `.json` file that `mcpServers` names, and puts
the report on that path in `plugin.json`. A directory counts as a plugin root when it holds
`.claude-plugin/plugin.json`, or when a `marketplace.json` of the repository lists it. The rule
makes no report for a `.mcp.json` when it cannot read that directory.

When a plugin root is also the repository root, its `.mcp.json` is the project file too. Validate
reads that file when the plugin has a manifest, so the rule reports the one fault above. With no
manifest, validate does not read the file, so the rule reports each fault.

The rule leaves these cases alone:

- An entry with `type: "sdk"`. Claude Code skips it with its own message: only an SDK host
  application can register such a server.[^http]
- A file with no `mcpServers` object. The rule `mcp-json-servers-key` reports it in a project
  `.mcp.json`. No rule reports it in a `managed-mcp.json`.
- An empty remote `url`. The rule `mcp-remote-url-empty` reports it in a project `.mcp.json`. No
  rule reports it in a `managed-mcp.json`.
- A `url` that holds a `${` reference, because the reference can expand to any text.
- Each other fault in a plugin `.mcp.json` and in the servers of `plugin.json`. Validate reports
  it. The root file of a repository that is a plugin with no manifest is not in this case.
- A path under `.claude/`, which Claude Code never reads. The rule `mcp-json-location` reports it.

Fail:

```json
{
  "mcpServers": {
    "docs": { "url": "https://docs.example.com/mcp" },
    "tool": { "command": "npx", "args": "-y my-tool" }
  }
}
```

Pass:

```json
{
  "mcpServers": {
    "docs": { "type": "http", "url": "https://docs.example.com/mcp" },
    "tool": { "command": "npx", "args": ["-y", "my-tool"] }
  }
}
```

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/mcp-server-schema': 'error'
```

## Sources

[^http]: [Connect Claude Code to tools via MCP: Option 1: Add a remote HTTP server](https://code.claude.com/docs/en/mcp#option-1-add-a-remote-http-server)
[^edit]: [Connect to MCP servers: Edit .mcp.json directly](https://code.claude.com/docs/en/mcp-quickstart#edit-mcpjson-directly)
[^quickstart]: [Connect to MCP servers: Troubleshooting](https://code.claude.com/docs/en/mcp-quickstart#troubleshooting)
[^validate]: [Plugin manifest reference: Validate the manifest](https://code.claude.com/docs/en/plugins/manifest-reference#validate-the-manifest)
[^plugin]: [Troubleshoot plugins: Server is configured but never connects](https://code.claude.com/docs/en/plugins/troubleshooting#server-is-configured-but-never-connects)
