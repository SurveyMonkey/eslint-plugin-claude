---
type: Reference
description: The ESLint rule claude/lsp-json-location, which reports a .lsp.json file outside a plugin, such as at a repository root with no plugin or under .claude, because the docs name a plugin as the source of LSP servers.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `lsp-json-location`

Put `.lsp.json` at the root of a plugin.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | no-op | `**/.lsp.json` |

The rule is `off` in `recommended`. It is a heuristic.

## Rule details

An LSP server gives Claude diagnostics and code navigation for a language. A plugin declares the
server in `.lsp.json` at the plugin root, or in the `lspServers` key of its manifest.[^components]
Claude Code takes the configuration of a language server from the plugin.[^tools] The docs name
no other place. So a `.lsp.json` at a repository root with no plugin, or under `.claude/`, may
have no effect.

The rule reports a `.lsp.json` when no folder from its own up to the repository root is a plugin
root. A plugin root is a directory that holds `.claude-plugin/plugin.json`. The report is on the
top-level value of the file. The rule does not read the content for a fault: `lsp-json-schema`
does.

The rule reports these places:

- A repository root with no plugin.
- A folder under `.claude/`, in a repository with no plugin above it.
- A folder of a repository that has a plugin only in a different folder.

The rule does not report a `.lsp.json` at a plugin root or below it. The `lspServers` key of the
manifest can name a `.json` file in a folder of the plugin. The rule makes no report when it
cannot read a plugin root, for example when `.claude-plugin/` is a link out of the repository. The
plugin root is then not known. When no `.git` is at or above the file, the repository root is the
folder of the file, and the rule reads no folder above it.

The manifest of a plugin is optional.[^manifest] A plugin with no `.claude-plugin/plugin.json`
gets a false report. This is a limit of the heuristic.

Fail:

```text
.claude/.lsp.json
```

Pass:

```text
.claude-plugin/plugin.json
.lsp.json
```

## Sources

[^components]: [Add components to a plugin: LSP servers](https://code.claude.com/docs/en/plugins/components#lsp-servers)
[^manifest]: [Plugin manifest reference: Manifest file](https://code.claude.com/docs/en/plugins/manifest-reference#manifest-file)
[^tools]: [Tools reference: LSP tool behavior](https://code.claude.com/docs/en/tools-reference#lsp-tool-behavior)
