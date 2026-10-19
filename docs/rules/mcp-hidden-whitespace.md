---
type: Reference
description: The ESLint rule claude/mcp-hidden-whitespace, which reports leading or trailing whitespace in the command, url, an args item, or a key or value of env and headers of an MCP server, because Claude Code uses the value as written.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# claude/mcp-hidden-whitespace

📝 Remove leading and trailing whitespace from the values of an MCP server.

💼 This rule is enabled in the following configs: ✅ `recommended`, 🔒 `strict`.

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| load | `**/.mcp.json` |

## Rule details

Claude Code warns when an MCP config value has hidden leading or trailing whitespace. A pasted
token with a trailing newline is the usual cause. Claude Code does not trim the value. It uses
the value as written.[^warnings] A header or a URL with such a character often fails to authenticate.

The rule checks the fields that Claude Code checks:

- `command`
- `url`
- each item of `args`
- the keys and the values of `env`
- the keys and the values of `headers`

A value has whitespace at an edge when it differs from its trimmed form. A space, a tab, a line
break and a no-break space all count. Whitespace inside a value is allowed. The empty string is
allowed.

The report is on the string. The message names the field and the server, and it never repeats the
value, because the value is often a credential. A key of `env` or `headers` gets its own message.

The rule reads the `mcpServers` object. A plugin `.mcp.json` may omit that wrapper. Then the
rule reads the top-level entries of the file. A directory
counts as a plugin root when it holds `.claude-plugin/plugin.json`, or when a `marketplace.json`
of the repository lists it. The rule makes no report when
it cannot read that directory. It skips the paths under `.claude/`, which `mcp-json-location`
reports.

Fail, where `\n` is a line break at the end of the token:

```json
{
  "mcpServers": {
    "docs": {
      "type": "http",
      "url": "https://docs.example.com/mcp",
      "headers": { "Authorization": "Bearer abc123\n" }
    }
  }
}
```

Pass:

```json
{
  "mcpServers": {
    "docs": {
      "type": "http",
      "url": "https://docs.example.com/mcp",
      "headers": { "Authorization": "Bearer abc123" }
    }
  }
}
```

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/mcp-hidden-whitespace': 'error'
```

## Sources

[^warnings]: [Connect Claude Code to tools via MCP: Configuration warnings](https://code.claude.com/docs/en/mcp#configuration-warnings)
