---
type: Reference
description: The ESLint rule claude/marketplace-command-source, which reports each command plugin source in a marketplace.json entry for review, because it runs a shell command on the machine of the user at install, at update, and once for each session.
owner: brianespinosa
created: 2026-10-10
related_issues: [12]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `marketplace-command-source`

Review each `command` plugin source.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | security | `**/.claude-plugin/marketplace.json` |

## Rule details

A `command` source is a shell command. Claude Code runs it on the machine of the user. It runs
it when the user installs or updates the plugin, and once for each session.[^command] The command prints
the path of the plugin directory. Claude Code shows users the whole string for review before it
runs.[^command] Administrators can turn the source type off with `disableCommandPluginSources`.

The rule reports each entry whose `source` is an object with `"source": "command"`. It makes no
claim that the command is unsafe. The report asks a reviewer to read the command. Turn the rule
off for a marketplace where `command` sources are expected.

The report is on the value of the `source` member. When an entry has two `source` keys, the rule reads the
last, as `JSON.parse` does. A `source` that is not an object with a string `source` is a fault for
`marketplace-schema` and `marketplace-source-schema`. The text of the command is for
`marketplace-source-schema`. The `command` source type is in
`src/data/marketplace-source-types.ts`.

The docs list no `claude plugin validate` message for this case.

Fail:

```json
{
  "name": "acme",
  "plugins": [
    {
      "name": "formatter",
      "source": { "source": "command", "command": "my-tool claude-plugin-path" }
    }
  ]
}
```

Pass:

```json
{
  "name": "acme",
  "plugins": [{ "name": "formatter", "source": "./plugins/formatter" }]
}
```

## Options

None.

## Sources

[^command]: [Marketplace reference: command plugin source](https://code.claude.com/docs/en/plugins/marketplace-reference#command-plugin-source)
