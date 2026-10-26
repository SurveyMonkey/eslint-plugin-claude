---
type: Reference
description: The ESLint rule claude/settings-strict-known-marketplaces-skills-dir, which reports a strictKnownMarketplaces list in a managed settings file that has no skills-dir entry, because skills-directory plugins then do not load.
owner: brianespinosa
created: 2026-10-10
related_issues: [12]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# claude/settings-strict-known-marketplaces-skills-dir

📝 Add the skills-dir source to a strictKnownMarketplaces allowlist.

⚠️ This rule _warns_ in the following configs: ✅ `recommended`, 🔒 `strict`.

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| practice | `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

Users keep skills-directory plugins under `~/.claude/skills/` or the `.claude/skills/` of a
project. Each is in a folder with a `.claude-plugin/plugin.json`. Claude Code does
not load them when any allowlist is set, also an empty one. The entry `{ "source": "skills-dir" }`
keeps them available. It matches no marketplace.[^org][^types][^policy]

An author can leave the entry out on purpose. So the rule has the severity `warn`.

The rule reports the `strictKnownMarketplaces` key of a managed file when no entry has
`"source": "skills-dir"`. It reads the alias `allowedMarketplaces` when the file does not set the
canonical key.[^aliases] The rule counts the canonical key as set for any value. A key set to `null`
counts as set, and the rule then ignores the alias. An empty list gets a report, because the docs
say that any allowlist stops the plugins.[^types]

The managed settings page merges `managed-settings.json` and each `managed-settings.d/*.json`
file into one source, and the lists combine.[^split] So the rule reads the sibling files through
`readManagedSource`. An entry in any file of the source satisfies the rule. The rule makes no report
in these cases:

- A `blockedMarketplaces` list in the source has a `skills-dir` entry. The docs say that the entry
  there stops the plugins, so the author chose it.[^org]
- A file of the source sets `managedSourcesBehavior` to `merge`. Claude Code then adds the lists
  of other managed sources, which the repository does not hold.[^merge]
- A file of the source locks a kind of customization with `strictPluginOnlyCustomization`. Claude Code
  then skips skills-directory plugins whether or not the entry is there, so the entry does
  nothing.[^org][^locked] The value `true` locks all four kinds. An array locks the kinds that it
  names: `skills`, `agents`, `hooks` or `mcp`.[^strict] A value that is not a Boolean, an array or
  `null`, such as `"true"`, `"false"` or `{}`, reads as `true`.[^closed] The table row of the key
  says so. The rule follows that row, and not the general rule for a quoted Boolean. The rule
  still reports for `false`, `null`, an empty array, and an array with no kind, such as `["foo"]`.
  Claude Code reads a value that is not valid in this way from v2.1.282. An earlier version drops
  the key, so such a value locks nothing there. The rule does not check the version.
- The rule cannot read a sibling file, or the `managed-settings.d` directory.
- The linted file is a hidden file in `managed-settings.d`.
- The text of the linted file does not parse as JSON.

Two files with a list that lacks the entry each get a report.

Fail:

```json
{
  "strictKnownMarketplaces": [{ "source": "github", "repo": "acme-corp/*" }]
}
```

Pass:

```json
{
  "strictKnownMarketplaces": [
    { "source": "github", "repo": "acme-corp/*" },
    { "source": "skills-dir" }
  ]
}
```

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/settings-strict-known-marketplaces-skills-dir': 'warn'
```

## Sources

[^org]: [Manage Claude Code plugins for your organization: Keep skills-directory plugins loading](https://code.claude.com/docs/en/plugins/org#keep-skills-directory-plugins-loading)
[^locked]: [Plugin loading reference: Skills-directory plugins blocked by managed settings](https://code.claude.com/docs/en/plugins/loading#skills-directory-plugins-blocked-by-managed-settings)
[^policy]: [Marketplace reference: Source values valid only in policy lists](https://code.claude.com/docs/en/plugins/marketplace-reference#source-values-valid-only-in-policy-lists)
[^types]: [All settings: Allowed source types](https://code.claude.com/docs/en/settings-reference#allowed-source-types)
[^aliases]: [All settings: Marketplace key aliases](https://code.claude.com/docs/en/settings-reference#marketplace-key-aliases)
[^split]: [Deploy managed settings: Split a file-based policy across teams](https://code.claude.com/docs/en/managed-settings#split-a-file-based-policy-across-teams)
[^merge]: [All settings: managedSourcesBehavior](https://code.claude.com/docs/en/settings-reference#managedsourcesbehavior)
[^strict]: [All settings: strictPluginOnlyCustomization](https://code.claude.com/docs/en/settings-reference#strictpluginonlycustomization)
[^closed]: [Deploy managed settings: Keys that fail closed](https://code.claude.com/docs/en/managed-settings#keys-that-fail-closed)
