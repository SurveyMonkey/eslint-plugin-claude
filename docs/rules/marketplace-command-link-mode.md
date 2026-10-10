---
type: Reference
description: The ESLint rule claude/marketplace-command-link-mode, which reports a command plugin source in a marketplace.json entry that sets mode to link, because Claude Code refuses to install a link-mode plugin on Windows.
owner: brianespinosa
created: 2026-10-10
related_issues: [12]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `marketplace-command-link-mode`

Do not set `mode` to `link` on a `command` plugin source.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/.claude-plugin/marketplace.json` |

## Rule details

A `command` source has a `mode`: `copy`, the default, or `link`. In `link` mode, Claude Code uses
the printed directory in place and copies nothing. Claude Code refuses to install a link-mode
plugin on Windows. The docs say to declare `"mode": "copy"` there.[^mode] The plugin works on
macOS and Linux, so the fault shows on Windows only.

The rule reports a `mode` member whose value is the string `link`, in an object `source` with
`"source": "command"`. The report is on the `mode` value. A marketplace that serves macOS and
Linux users only can turn the rule off.

A `mode` of another type or another word is a fault for `marketplace-source-schema`. The rule does
not report it. When an entry has two `mode` keys, the rule reads the last. It does the same for
two `source` keys, as `JSON.parse` does. The `command` source type is in
`src/data/marketplace-source-types.ts`.

The docs list no `claude plugin validate` message for this case.

Fail:

```json
{
  "name": "acme",
  "plugins": [
    {
      "name": "formatter",
      "source": { "source": "command", "command": "my-tool claude-plugin-path", "mode": "link" }
    }
  ]
}
```

Pass:

```json
{
  "name": "acme",
  "plugins": [
    {
      "name": "formatter",
      "source": { "source": "command", "command": "my-tool claude-plugin-path", "mode": "copy" }
    }
  ]
}
```

## Options

None.

## Sources

[^mode]: [Marketplace reference: Copy mode and link mode](https://code.claude.com/docs/en/plugins/marketplace-reference#copy-mode-and-link-mode)
