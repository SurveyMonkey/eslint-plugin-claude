---
type: Reference
description: The ESLint rule claude/marketplace-relative-source-escape-symlink, which reports a relative source in a marketplace.json entry whose real path is out of the marketplace root through a link, inside the repository, because Claude Code refuses such an entry in a marketplace that it fetches from a remote source.
owner: brianespinosa
created: 2026-10-07
related_issues: [12]
stale_after: 2027-04-07
generated:
  by: claude-code
  at: 2026-10-07T00:00:00Z
---

# `marketplace-relative-source-escape-symlink`

Keep a relative marketplace source inside the marketplace root.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | security | `**/.claude-plugin/marketplace.json` |

## Rule details

A relative `source` names a directory inside the marketplace, from the marketplace root.[^relative]
The marketplace root is the directory that holds `.claude-plugin/`. For a marketplace that
Claude Code fetches from a remote source, such as git, Claude Code refuses an entry that reaches its
target through a symbolic link that resolves outside the marketplace directory.[^refusal] The
plugin does not install or load. The docs state no refusal for a local marketplace.

The rule takes the real path of the source directory. It reports the `source` value when that path
is out of the marketplace root. A link on any part of the path can cause this. The report does not
depend on the content of the directory. The rule reports a link to a file out of the root too.

`claude plugin validate` does not follow links. It gives a warning for a local source that is or
traverses a symlink. It does not read that path.[^validation] So validate does not find the
target of the link.

The rule makes no report in these cases:

- **The link stays inside the marketplace root.** The docs say to keep each link that a source
  crosses inside the marketplace directory.[^refusal] Claude Code also keeps a link between two
  plugins of one marketplace.[^symlinks]
- **The source is not a relative path.** An object source, a source that
  [`marketplace-relative-source-format`](marketplace-relative-source-format.md) reports, and a value
  that is not a string are not read.
- **The target is out of the repository, or is not there.** The rule reads no file out of the
  repository (ADR 001, Decision 14). A link to a directory out of the repository can resolve on one
  machine and be dangling on another. A dangling link is also not reported. The directory is for
  [`marketplace-relative-source-exists`](marketplace-relative-source-exists.md) when nothing is at
  the path.
- **The tree has no `.git`.** The repository is then the marketplace root, so every target out of
  the marketplace root is out of the repository.
- **The rule cannot read a directory on the path.** A permission error is an example.

When a key appears twice, the rule reads the last, as `JSON.parse` does.

Fail, with `plugins/formatter` as a link to `../../shared/formatter`, a directory in the repository
but out of the marketplace root:

```json
{
  "name": "acme",
  "owner": { "name": "Acme" },
  "plugins": [{ "name": "formatter", "source": "./plugins/formatter" }]
}
```

Pass: the same file, with `plugins/formatter` as a directory in the marketplace root, or as a link
to another directory in the marketplace root.

## Options

None.

## Sources

[^relative]: [Marketplace reference: Relative path plugin source](https://code.claude.com/docs/en/plugins/marketplace-reference#relative-path-plugin-source)
[^refusal]: [Error reference: Marketplace entry path does not stay inside the marketplace directory](https://code.claude.com/docs/en/errors#marketplace-entry-path-does-not-stay-inside-the-marketplace-directory)
[^validation]: [Marketplace reference: Validation messages](https://code.claude.com/docs/en/plugins/marketplace-reference#validation-messages)
[^symlinks]: [Host and maintain a marketplace: Share files within a marketplace with symlinks](https://code.claude.com/docs/en/plugins/host-marketplace#share-files-within-a-marketplace-with-symlinks)
