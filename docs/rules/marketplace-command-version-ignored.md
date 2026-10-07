---
type: Reference
description: The ESLint rule claude/marketplace-command-version-ignored, which reports a version in a marketplace.json entry whose source is a command source, because Claude Code ignores the entry version and derives the version from the command output.
owner: brianespinosa
created: 2026-10-06
related_issues: [12]
stale_after: 2027-04-06
generated:
  by: claude-code
  at: 2026-10-06T00:00:00Z
---

# `marketplace-command-version-ignored`

Do not set the `version` of an entry that has a `command` source.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude-plugin/marketplace.json` |

## Rule details

For a `command` source, Claude Code derives the version from what the command printed. The version
is a 12-character hash, or `<manifest version>-<hash>` when the plugin manifest sets one. Claude
Code ignores the `version` of the marketplace entry.[^version] The rule reports a string `version`
in an entry whose `source` is an object with `"source": "command"`. A user who sets it expects a
pinned version, and gets none.

The rule reads each object in `plugins`. When an entry has two `source` keys or two `version` keys,
the rule reads the last of each, as `JSON.parse` does. The report is on the `version` member.

The rule does not check these values. They are faults for `marketplace-schema`:

- an entry that is not an object, and a `source` that is not an object with a string `source`
- a `version` that is not a string

A `version` inside the source object, a top-level `version`, and the `version` of a `plugin.json`
are not an entry `version`. The rule does not read them. The manifest `version` still counts for a
`command` source, as the docs describe.[^version] The `command` source type is in
`src/data/marketplace-source-types.ts`, as of Claude Code 2.1.288.[^sources]

The docs list no `claude plugin validate` message for this case.[^validation] The one version
warning is for a relative-path entry whose `version` differs from its `plugin.json`.

Fail:

```json
{
  "name": "acme",
  "plugins": [
    {
      "name": "formatter",
      "version": "1.0.0",
      "source": { "source": "command", "command": "my-tool claude-plugin-path" }
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
      "source": { "source": "command", "command": "my-tool claude-plugin-path" }
    }
  ]
}
```

## Options

None.

## Sources

[^version]: [Plugin loading reference: How Claude Code computes the version](https://code.claude.com/docs/en/plugins/loading#how-claude-code-computes-the-version)
[^sources]: [Marketplace reference: Plugin sources](https://code.claude.com/docs/en/plugins/marketplace-reference#plugin-sources)
[^validation]: [Marketplace reference: Validation messages](https://code.claude.com/docs/en/plugins/marketplace-reference#validation-messages)
