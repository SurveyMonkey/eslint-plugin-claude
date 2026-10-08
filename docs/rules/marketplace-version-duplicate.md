---
type: Reference
description: The ESLint rule claude/marketplace-version-duplicate, which reports a marketplace.json entry with a version when the plugin.json of its relative source also sets a version, because plugin.json wins with no warning for equal values.
owner: brianespinosa
created: 2026-10-07
related_issues: [12]
stale_after: 2027-04-07
generated:
  by: claude-code
  at: 2026-10-07T00:00:00Z
---

# `marketplace-version-duplicate`

Set the version of a marketplace plugin in the entry or in its `plugin.json`, not in both.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude-plugin/marketplace.json` |

## Rule details

Claude Code takes the version of a plugin from `plugin.json` first, and then from the marketplace
entry.[^computes] The docs say not to set `version` in both. If you do, Claude Code uses the
`plugin.json` value without warning.[^release] So the entry `version` has no effect.

The rule reads each object in `plugins` that has a relative `source`. It resolves the source from
the marketplace root, the directory that holds `.claude-plugin/`. A bare name resolves under
`metadata.pluginRoot`.[^relative] The rule reads `.claude-plugin/plugin.json` in that directory. It
reports the entry `version` when both files set one. The report is on the entry `version` value.
The report names both values, and it says whether they are equal or different.

`claude plugin validate` reports only a mismatch, as the warning `Entry declares version "<a>" but
<path>/plugin.json says "<b>"`, and only for a relative-path entry.[^validation] So for values that
differ, the rule and validate both report. For equal values, only the rule reports.

The rule makes no report in these cases:

- **Only one file sets a version.** That is the form that the docs recommend.
- **A version is an empty string.** An empty string is not a version. The docs do not say how Claude
  Code reads it, so the rule does not count it. A version that is not a string is a fault for
  [`marketplace-schema`](marketplace-schema.md).
- **The source is not a relative path.** An object source, a source that
  [`marketplace-relative-source-format`](marketplace-relative-source-format.md) reports, and a value
  that is not a string are not read. The version of a `command` source is for
  [`marketplace-command-version-ignored`](marketplace-command-version-ignored.md).
- **The rule cannot read the manifest.** The directory or the manifest is not there, the manifest
  does not parse to an object, or a link on the path is dangling or leads out of the repository. The
  rule reads no file out of the repository (ADR 001, Decision 14). With no `.git`, the repository
  is the marketplace root. A source that leaves the marketplace root through a link is a fault for
  [`marketplace-relative-source-escape-symlink`](marketplace-relative-source-escape-symlink.md).

When a key appears twice, the rule reads the last, as `JSON.parse` does.

Fail:

```json
{
  "name": "acme",
  "owner": { "name": "Acme" },
  "plugins": [{ "name": "formatter", "source": "./plugins/formatter", "version": "1.0.0" }]
}
```

with `plugins/formatter/.claude-plugin/plugin.json`:

```json
{ "name": "formatter", "version": "1.0.0" }
```

Pass: the same file, with no `version` in the entry.

## Options

None.

## Sources

[^computes]: [Plugin loading reference: How Claude Code computes the version](https://code.claude.com/docs/en/plugins/loading#how-claude-code-computes-the-version)
[^release]: [Host and maintain a marketplace: Release a new version](https://code.claude.com/docs/en/plugins/host-marketplace#release-a-new-version)
[^validation]: [Marketplace reference: Validation messages](https://code.claude.com/docs/en/plugins/marketplace-reference#validation-messages)
[^relative]: [Marketplace reference: Relative path plugin source](https://code.claude.com/docs/en/plugins/marketplace-reference#relative-path-plugin-source)
