---
type: Reference
description: The ESLint rule claude/lsp-json-schema, which reports a .lsp.json at a plugin root that Claude Code skips, because a server config has an unknown key, no command, a bad value type, a command with whitespace or a bad extension map.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `lsp-json-schema`

Write `.lsp.json` as a map of server names to configs, with the documented fields.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.lsp.json` |

The rule lints a `.lsp.json` at the root of a plugin: the directory that holds
`.claude-plugin/plugin.json`. The rule does not lint `plugin.json`. It makes no report for a
`.lsp.json` in another directory, and none when it cannot read the directory.

## Rule details

`.lsp.json` maps a server name to a server config. It has no wrapper key.[^components] Each config
is a strict object. An unknown key is an error.[^reference][^strict] When any entry is invalid, Claude Code
skips the whole file. The `/plugin` Errors tab shows `Invalid LSP server config for ".lsp.json"`.
`claude plugin validate` does not read this file, so the rule is the only check before a person
installs the plugin.[^components]

The rule reports these faults:

- The file is not an object. The report is on the value.
- A config is not an object. The report is on the config.
- A config has a key that is not a documented field. The report is on the key. The `lspServers`
  wrapper of `plugin.json` is one case: its content gives one report for each fault.
- A config has no `command` or no `extensionToLanguage`. The report is on the config.
- A value has the wrong type. The report is on the value.
- `command` has whitespace and does not start with `/`. Put the program in `command` and its
  arguments in `args`. The report is on the value.
- `extensionToLanguage` is empty. The report is on the value.
- A key of `extensionToLanguage` does not start with a dot, or a language ID is not a string. The
  report is on the key, or on the value.

### Fields

| Field | The value must be |
|-------|-------------------|
| `command` | A string. No whitespace unless the value starts with `/` |
| `extensionToLanguage` | An object with at least one entry. Each key starts with a dot, such as `".go"`. Each value is a string |
| `args` | An array of strings |
| `transport` | `stdio` or `socket` |
| `env` | An object of strings |
| `initializationOptions`, `settings` | Any value |
| `workspaceFolder` | A string |
| `startupTimeout`, `shutdownTimeout`, `requestTimeout` | A positive integer. `requestTimeout` needs Claude Code v2.1.288 or later |
| `restartOnCrash`, `diagnostics` | A Boolean |
| `maxRestarts` | An integer of zero or more |

The rule accepts `transport: "socket"`, because the value is valid. Claude Code runs every server
over stdio, and `lsp-transport-socket` reports the value.[^reference] The inline `lspServers` key
of `plugin.json` has the same fields. `claude plugin validate` checks it, so this rule does not.
When two servers have one name, or two fields of a config have one name, the rule reads the last,
as `JSON.parse` does.

Fail, in `.lsp.json` at a plugin root:

```json
{
  "go": {
    "command": "gopls serve",
    "extensionToLanguage": { "go": "go" },
    "timeout": 5000
  }
}
```

Pass:

```json
{
  "go": {
    "command": "gopls",
    "args": ["serve"],
    "extensionToLanguage": { ".go": "go" }
  }
}
```

## Sources

[^components]: [Add components to a plugin: LSP servers](https://code.claude.com/docs/en/plugins/components#lsp-servers)
[^reference]: [Plugin manifest reference: lspServers](https://code.claude.com/docs/en/plugins/manifest-reference#lspservers)
[^strict]: [Plugin manifest reference: Unrecognized fields](https://code.claude.com/docs/en/plugins/manifest-reference#unrecognized-fields)
