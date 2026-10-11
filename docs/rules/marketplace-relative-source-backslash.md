---
type: Reference
description: The ESLint rule claude/marketplace-relative-source-backslash, which reports a relative plugin source in a marketplace.json entry that has a backslash after the leading ./, because Claude Code refuses such a path on macOS and Linux.
owner: brianespinosa
created: 2026-10-10
related_issues: [12]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `marketplace-relative-source-backslash`

Write a relative plugin source with forward slashes.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/.claude-plugin/marketplace.json` |

## Rule details

On macOS and Linux, Claude Code refuses an entry path that has a backslash anywhere after the
first `./`.[^path] The plugin then does not install or load.[^error] The path works on Windows.
So the fault shows only on the other systems.

The rule reports a string `source` that starts with `./` and has a backslash after it. The report
is on the string.

`marketplace-relative-source-format` reports every other path with a backslash:

- A network path, such as `\\server\share`.
- An absolute path, such as `\plugins\a` or `C:\plugins\a`.
- A path with a `..` segment, such as `./a\..\b`.
- A path that does not start with `./`, such as `.\a` or `plugins\a`.

This rule is silent on those paths, so no path has two reports. A `source` that is not a string is
a fault for `marketplace-schema`. When an entry has two `source` keys, the rule reads the last, as
`JSON.parse` does. The rule does not read `metadata.pluginRoot`. The docs give the backslash
requirement for an entry path.

The docs list no `claude plugin validate` message for this case.

Fail:

```json
{
  "name": "acme",
  "plugins": [{ "name": "formatter", "source": "./plugins\\formatter" }]
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

[^path]: [Marketplace reference: Relative path plugin source](https://code.claude.com/docs/en/plugins/marketplace-reference#relative-path-plugin-source)
[^error]: [Error reference: Marketplace entry path does not stay inside the marketplace directory](https://code.claude.com/docs/en/errors#marketplace-entry-path-does-not-stay-inside-the-marketplace-directory)
