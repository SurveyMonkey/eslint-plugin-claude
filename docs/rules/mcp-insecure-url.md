---
type: Reference
description: The ESLint rule claude/mcp-insecure-url, which reports a remote MCP server in a project .mcp.json whose url uses http:// or ws:// to a host that is not on the machine, and an http:// MCP bundle URL in a plugin.json, because the traffic goes in clear text.
owner: brianespinosa
created: 2026-10-10
related_issues: [16, 43]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-17T00:00:00Z
---

# claude/mcp-insecure-url

📝 Use https:// or wss:// for a remote MCP server, and https:// for an MCP bundle URL.

⚠️ This rule _warns_ in the following configs: ✅ `recommended`, 🔒 `strict`.

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| security | `**/.mcp.json`, `**/.claude-plugin/plugin.json` |

## Rule details

A remote server at an `http://` or `ws://` URL sends its traffic, and its headers, in clear text.
Use `https://` or `wss://` for a host that is not on the machine.

`claude plugin validate` checks each MCP server entry that a plugin declares, in its `.mcp.json`,
in a `.json` file that `mcpServers` names, or inline in `plugin.json`. It warns about an `http://`
or `ws://` URL to a host that is not loopback. This check needs Claude Code v2.1.281 or later.[^validate]
So the rule makes no report for the `.mcp.json` of a plugin with a manifest. It makes none for the
servers of a `plugin.json` either. Validate 2.1.302 fails a plugin with no `plugin.json` ("No
manifest found in directory"). On the marketplace, it does not read the `.mcp.json` of the plugin.
So the rule reads the project `.mcp.json`, and the `.mcp.json` of a plugin with no manifest.

The rule reports a server whose `type` is `http`, `streamable-http`, `sse` or `ws`, and whose
`url` has the scheme `http` or `ws`. The report is on the `url`. The scheme and the host match
ignore letter case, and the host ignores a trailing dot.

The rule makes no report in these cases:

- The host is on the machine: `localhost`, an address from `127.0.0.0/8`, or `[::1]`.
- The `url` does not parse, or a `${` reference hides the scheme or the host. The rule does not
  know the host. A `${` in the port does not hide the host, so a report stays.
- The server has no `type`. Claude Code reads it as a stdio server. It skips a server that has a
  `url` and no `type`, so the URL is never used.

Of two servers with one name, or two keys with one name, the last one counts, as `JSON.parse`
keeps it. The rule skips the paths under `.claude/`, which `mcp-json-location` reports.

Fail:

```json
{
  "mcpServers": {
    "tracker": { "type": "http", "url": "http://mcp.example.com/mcp" }
  }
}
```

Pass:

```json
{
  "mcpServers": {
    "tracker": { "type": "http", "url": "https://mcp.example.com/mcp" },
    "dev": { "type": "http", "url": "http://localhost:3000/mcp" }
  }
}
```

### MCP bundle URL

The `mcpServers` key of `.claude-plugin/plugin.json` also takes the path or URL of an MCP bundle,
a `.mcpb` or `.dxt` file. The value is a string, or a string item of an array. Claude Code
downloads a bundle URL.[^mcpservers] The docs ask for "a path inside the plugin or an `https://`
URL".[^mcpb] `claude plugin validate` passes an `http://` bundle URL with no warning (Claude Code
2.1.302). So the rule reports an `http://` bundle URL to a host that is not on the machine. The
report is on the string.

The rule makes no report in these cases:

- The string is a path, a URL with a scheme other than `http`, or a URL that does not parse. An
  inline map is not a string.
- The host is on the machine, or a `${` reference hides it, for the reasons of the server case.
- A character comes before `http://`, such as a space or a tab. Or the string starts with `http:`
  and not two `/` characters. Validate reads it as a path and fails it. Validate says that the
  runtime loader reports a load failure.
- The plugin is directly under `.claude/skills/`. Claude Code skips each bundle of such a
  plugin.[^loading]

The rule does not read the extension. Validate fails an extension that is not `.mcpb` or
`.dxt`.[^mcpservers] The rule reads only the last `mcpServers` member.

Fail, in `.claude-plugin/plugin.json`:

```json
{
  "name": "db-plugin",
  "mcpServers": "http://downloads.example.com/db.mcpb"
}
```

Pass:

```json
{
  "name": "db-plugin",
  "mcpServers": ["./servers/db.mcpb", "https://downloads.example.com/db.mcpb"]
}
```

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/mcp-insecure-url': 'warn'
```

## Sources

[^validate]: [Plugin manifest reference: Validate the manifest](https://code.claude.com/docs/en/plugins/manifest-reference#validate-the-manifest)
[^mcpservers]: [Plugin manifest reference: mcpServers](https://code.claude.com/docs/en/plugins/manifest-reference#mcpservers)
[^mcpb]: [Add components to a plugin: Include a packaged MCPB server](https://code.claude.com/docs/en/plugins/components#include-a-packaged-mcpb-server)
[^loading]: [Plugin loading reference: Plugins shared through a repository](https://code.claude.com/docs/en/plugins/loading#plugins-shared-through-a-repository)
