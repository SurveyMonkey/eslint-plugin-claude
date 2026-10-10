---
type: Reference
description: The ESLint rule claude/lsp-transport-socket, which reports transport socket in an LSP server config of .lsp.json or of the inline lspServers of plugin.json, because Claude Code accepts the value but runs every server over stdio.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `lsp-transport-socket`

Do not set the `transport` of an LSP server to `socket`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.lsp.json`, `**/.claude-plugin/plugin.json` |

## Rule details

The `transport` field of an LSP server config is `stdio` (the default) or `socket`. Claude Code
accepts `socket`, but runs every server over stdio.[^reference] So a server that is written to
listen on a socket never gets one. The stdout protocol rules of stdio apply to it. `claude plugin
validate` accepts the value too, so nothing else reports it.

The rule reports `"transport": "socket"` in a server config. The report is on the value. It reads
two places:

- `.lsp.json` at the root of a plugin: the directory that holds `.claude-plugin/plugin.json`. The
  file maps a server name to its config.[^components] The rule makes no report for a `.lsp.json`
  in another directory, and none when it cannot read the directory.
- The inline `lspServers` of `.claude-plugin/plugin.json`. The key takes an inline map, a path, or
  an array of those. The rule reads each inline map. It does not read a path.

The rule does not check any other value of `transport`. `lsp-json-schema` reports a value that is
not `stdio` or `socket` in `.lsp.json`. When two servers have one name, or a config has two
`transport` fields, the rule reads the last, as `JSON.parse` does.

Fail, in `.lsp.json` at a plugin root:

```json
{
  "go": {
    "command": "gopls",
    "extensionToLanguage": { ".go": "go" },
    "transport": "socket"
  }
}
```

Pass:

```json
{
  "go": {
    "command": "gopls",
    "extensionToLanguage": { ".go": "go" },
    "transport": "stdio"
  }
}
```

## Sources

[^reference]: [Plugin manifest reference: lspServers](https://code.claude.com/docs/en/plugins/manifest-reference#lspservers)
[^components]: [Add components to a plugin: LSP servers](https://code.claude.com/docs/en/plugins/components#lsp-servers)
