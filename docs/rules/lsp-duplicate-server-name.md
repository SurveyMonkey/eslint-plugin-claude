---
type: Reference
description: The ESLint rule claude/lsp-duplicate-server-name, which reports an LSP server name that one plugin declares twice across .lsp.json, the .json files of lspServers and the inline maps, because a later declaration replaces the earlier server.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `lsp-duplicate-server-name`

Declare each LSP server name of a plugin once.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | consistency | `**/.claude-plugin/plugin.json` |

## Rule details

Claude Code loads `.lsp.json` at the plugin root first. Then it loads each value of `lspServers`
in order. A server name that a later source declares replaces the earlier server.[^manifest] The
manifest server replaces the server of `.lsp.json` that has the same name.[^components] The earlier
server never runs.

The `lspServers` key takes a `.json` file path, an inline map of server name to config, or an
array of those.[^manifest] The rule reads `.lsp.json` at the plugin root, each `.json` file that
`lspServers` names, and each inline map. It reports a name that a later source repeats. The report
is on the later declaration: on the name of an inline server, or on the path of a file. The message
names the source of the first declaration.

A source declares a name once. When one file has two keys of one name, the rule reads the last,
as `JSON.parse` does. So that file alone gives no report.

The rule reads only the files that it can see (ADR 001, Decision 14). These add no name, and a
report rests on the sources that do read:

- A path that is not a plain `./` path to a `.json` file. A path with `..` is for
  `claude plugin validate`.
- A file that is not there, that does not parse, or that the process cannot read.
- A link that leads out of the plugin directory, or out of the repository, and a dangling link.

The rule reads the names only. [`lsp-json-schema`](lsp-json-schema.md) checks the shape of each
config. [`lsp-extension-conflict`](lsp-extension-conflict.md) checks the extensions that the
servers claim.

Fail, with a `.lsp.json` that declares `go`, in `.claude-plugin/plugin.json`:

```json
{
  "name": "go-tools",
  "lspServers": {
    "go": { "command": "gopls", "extensionToLanguage": { ".go": "go" } }
  }
}
```

Pass:

```json
{
  "name": "go-tools",
  "lspServers": {
    "go-mod": { "command": "gopls", "extensionToLanguage": { ".mod": "go.mod" } }
  }
}
```

## Sources

[^manifest]: [Plugin manifest reference: lspServers](https://code.claude.com/docs/en/plugins/manifest-reference#lspservers)
[^components]: [Plugin components: LSP servers](https://code.claude.com/docs/en/plugins/components#lsp-servers)
