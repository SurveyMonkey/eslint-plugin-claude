---
type: Reference
description: The ESLint rule claude/marketplace-entry-root-skills, which reports the skill directories under skills/ that a marketplace.json entry omits when its source is the marketplace root and it lists skills, because Claude Code loads the listed skills only.
owner: brianespinosa
created: 2026-10-07
related_issues: [12]
stale_after: 2027-04-07
generated:
  by: claude-code
  at: 2026-10-07T00:00:00Z
---

# `marketplace-entry-root-skills`

List every skill directory in the `skills` of an entry whose source is the marketplace root.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude-plugin/marketplace.json` |

## Rule details

The docs state one case for an entry whose `source` is the marketplace root. When the entry lists
specific `skills` subdirectories, only those subdirectories load. Claude Code does not scan the
default `skills/` directory.[^combine] A skill directory that the entry omits does not load. This
differs from the `skills` key in `plugin.json`, which adds to the default directory.[^default]

The rule reads each object in `plugins` that has a relative `source`, and a `skills` value. It
resolves the source from the marketplace root, the directory that holds `.claude-plugin/`.[^relative]
When the real path of the source is the marketplace root, the rule lists the folders in `skills/`
that hold a `SKILL.md`. It reports the folders that the entry does not list. The report is on the
`skills` key and its value. It names the omitted folders in name order. A
`plugin.json` at the marketplace root does not change the result, and the rule does not require one.

The `skills` value is a path, or an array of paths. A path lists a skill when it is `./skills/<name>`,
with or without a trailing slash. The rule reads a path in normal form, so `./skills/./a` lists `a`.
A path that lists `./skills` or `.` holds every skill, so it gives no report.[^paths]

The rule makes no report in these cases:

- **The `skills` value is not readable.** A value that is not a string or an array of strings, an
  empty array, an empty string, and a path with no `./` prefix, with `..`, with a backslash, or in
  a network or absolute form give no report. The docs do not say how Claude Code reads them. The path
  rules are for [`marketplace-entry-component-paths`](marketplace-entry-component-paths.md).
- **The source is not the marketplace root.** The sentence of the docs is about the root. A plugin
  in a subdirectory gets no report. A source that is not a relative path, or that
  [`marketplace-relative-source-format`](marketplace-relative-source-format.md) reports, is not read.
- **The rule cannot read the directory.** The manifest at the root does not parse to an object, or
  `skills/` is not there, is not a directory, or fails to read. A `skills/` directory that is a link
  out of the marketplace root, or that is dangling, gives no report. The rule reads no file out of
  the repository (ADR 001, Decision 14). With no `.git`, the repository is the marketplace root.
- **A skill folder links out of the marketplace root, or is dangling.** The rule does not count it.

When a key appears twice, the rule reads the last, as `JSON.parse` does. The docs do not say that
`claude plugin validate` reports an omitted skill.

Fail: the root `skills/` holds `review` and `deploy`.

```json
{
  "name": "acme",
  "owner": { "name": "Acme" },
  "plugins": [
    {
      "name": "acme-skills",
      "source": ".",
      "skills": ["./skills/review"]
    }
  ]
}
```

Pass: the same file, with `"skills": ["./skills/review", "./skills/deploy"]` or `"skills": ["./skills"]`.

## Options

None.

## Sources

[^combine]: [Plugin manifest reference: How entry fields combine with plugin.json](https://code.claude.com/docs/en/plugins/manifest-reference#how-entry-fields-combine-with-pluginjson)
[^default]: [Plugin manifest reference: How each key combines with its default location](https://code.claude.com/docs/en/plugins/manifest-reference#how-each-key-combines-with-its-default-location)
[^paths]: [Plugin manifest reference: Path-only fields](https://code.claude.com/docs/en/plugins/manifest-reference#path-only-fields)
[^relative]: [Marketplace reference: Relative path plugin source](https://code.claude.com/docs/en/plugins/marketplace-reference#relative-path-plugin-source)
