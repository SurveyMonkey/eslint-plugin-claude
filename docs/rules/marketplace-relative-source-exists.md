---
type: Reference
description: The ESLint rule claude/marketplace-relative-source-exists, which reports a relative source in a marketplace.json entry that names a directory that does not exist, from the marketplace root, because the install fails and claude plugin validate passes.
owner: brianespinosa
created: 2026-10-07
related_issues: [12]
stale_after: 2027-04-07
generated:
  by: claude-code
  at: 2026-10-07T00:00:00Z
---

# `marketplace-relative-source-exists`

Name an existing directory in a relative marketplace source.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude-plugin/marketplace.json` |

## Rule details

A relative `source` resolves from the marketplace root, the directory that holds `.claude-plugin/`.
It does not resolve from `.claude-plugin/` itself.[^root][^file] A bare name resolves under
`metadata.pluginRoot`.[^relative] When the directory is not there, `claude plugin validate` passes.
`claude plugin install` then fails with `Source path does not exist: <path>`.[^root][^install] The
rule reports the `source` value when nothing is at the resolved path.

The rule makes no report in these cases:

- **The source is not a relative path.** An object source, a source that
  [`marketplace-relative-source-format`](marketplace-relative-source-format.md) reports, and a value
  that is not a string are not read.
- **A link hides the path.** A link on the path is dangling, or leads out of the repository. The rule
  reads no file out of the repository (ADR 001, Decision 14), and a dangling link can lead to a
  place that exists on another machine. With no `.git`, the repository is the marketplace root.
- **The rule cannot read a directory on the path.** A permission error is an example.
- **The source is a file.** The docs name a missing directory only, and give no message for a file.

A source that leaves the marketplace root through a link is a fault for
`marketplace-relative-source-escape-symlink`. This rule makes no report for it.

When a key appears twice, the rule reads the last, as `JSON.parse` does.

Fail:

```json
{
  "name": "acme",
  "owner": { "name": "Acme" },
  "plugins": [{ "name": "formatter", "source": "./plugins/formatter" }]
}
```

with no `plugins/formatter` directory next to `.claude-plugin/`.

Pass: the same file, with the directory `plugins/formatter` in the marketplace root.

## Options

None.

## Sources

[^root]: [Create a marketplace: Write relative paths from the marketplace root](https://code.claude.com/docs/en/plugins/create-marketplace#write-relative-paths-from-the-marketplace-root)
[^relative]: [Marketplace reference: Relative path plugin source](https://code.claude.com/docs/en/plugins/marketplace-reference#relative-path-plugin-source)
[^install]: [Create a marketplace: Problems that surface when you add or install](https://code.claude.com/docs/en/plugins/create-marketplace#problems-that-surface-when-you-add-or-install)
[^file]: [Marketplace reference: Marketplace file](https://code.claude.com/docs/en/plugins/marketplace-reference#marketplace-file)
