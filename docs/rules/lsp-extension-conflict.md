---
type: Reference
description: The ESLint rule claude/lsp-extension-conflict, which reports a file extension that two LSP servers of the plugins of one marketplace claim, because Claude Code uses the first registered server for those files and not the other.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `lsp-extension-conflict`

Give each LSP server of a marketplace its own file extensions.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | consistency | `**/.claude-plugin/marketplace.json` |

## Rule details

Each file extension gets one LSP server. When two enabled servers claim the same extension, the
first registered server handles those files. The other server is not used for them. This holds
when the servers come from one plugin or from two plugins.[^components] Claude Code shows the
warning `LSP server "<name>" is not used for <ext> files` in the `/plugin` **Errors** tab.[^components]

The rule lints the marketplace file of a repository. For each entry with a relative `source`, it
reads the plugin at that path. It uses the reader of the other marketplace rules.

Then it reads the servers of the plugin. These are in `.lsp.json` at the plugin root, in each
`.json` file that `lspServers` names, and in each inline map.[^manifest] A server name that a
later source declares replaces the earlier server, so the earlier server claims nothing. The claim
of a server is the set of keys of its `extensionToLanguage` map.

The rule reports an extension that a second server claims. The report is on the `source` of the
entry of that server. The message names the extension, both servers, and both plugins. A plugin
gets one report for each extension. The servers of one plugin can conflict with each other, so the
rule reports that case too.

The rule cannot know which server Claude Code registers first, and the message does not say. The
order depends on which plugins a user enables.

The rule reads only the files that it can see (ADR 001, Decision 14). It adds no claim for these:

- An entry with a source that is not a relative path, such as a GitHub or npm source.
- A plugin directory that is not there, that is a dangling link, or that leads out of the
  repository.
- A server file that is not there, does not parse, or cannot be read.

The rule does not read the `lspServers` of the marketplace entry itself. It does not read a plugin
that no marketplace lists. Two entries with one source count as one plugin. The match of an
extension is exact, with the letter case as written.

[`lsp-duplicate-server-name`](lsp-duplicate-server-name.md) checks the names of the servers of one
plugin. [`lsp-json-schema`](lsp-json-schema.md) checks the shape of each config.

Fail, in `.claude-plugin/marketplace.json`, with `.ts` in the `.lsp.json` of both plugins:

```json
{
  "name": "tools",
  "plugins": [
    { "name": "ts-a", "source": "./plugins/ts-a" },
    { "name": "ts-b", "source": "./plugins/ts-b" }
  ]
}
```

Pass: give the servers of the two plugins different extension keys.

## Sources

[^components]: [Plugin components: LSP servers](https://code.claude.com/docs/en/plugins/components#lsp-servers)
[^manifest]: [Plugin manifest reference: lspServers](https://code.claude.com/docs/en/plugins/manifest-reference#lspservers)
