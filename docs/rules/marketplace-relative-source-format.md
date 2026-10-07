---
type: Reference
description: The ESLint rule claude/marketplace-relative-source-format, which reports a string source in a marketplace.json entry that has no ./ prefix, is absolute, contains .., or has the form of a network path, and the same faults in metadata.pluginRoot.
owner: brianespinosa
created: 2026-10-06
related_issues: [12]
stale_after: 2027-04-06
generated:
  by: claude-code
  at: 2026-10-06T00:00:00Z
---

# `marketplace-relative-source-format`

Write a relative plugin source as the docs require.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude-plugin/marketplace.json` |

## Rule details

A plugin source that is a string is a relative path. It names a directory in the marketplace, from
the marketplace root.[^sources] The rule reads the string `source` of each object in `plugins`. It
reports one fault for each value. It checks the faults in this order:

- **Network path.** The value starts with two slashes or two backslashes, in any mix. Claude Code
  refuses an entry path that has the form of a network path.[^refusal]
- **Absolute path.** The value starts with a slash or a backslash, or with a drive letter and a
  slash. Claude Code refuses an absolute entry path.[^refusal]
- **Parent path.** The value contains `..` anywhere. A path that contains `..` fails
  validation.[^relative]
- **No prefix.** The value does not start with `./`. The docs allow two other forms. A value of `.`
  alone means the marketplace root. A bare name is valid when `metadata.pluginRoot` is set.[^relative]

A bare name is one directory name with no slash and no backslash. A source with a slash, such as
`team-a/formatter`, is not a bare name. It needs the `./` prefix, even when `metadata.pluginRoot`
is set.[^bare] The rule counts `metadata.pluginRoot` as set when it is a string that is not empty.

The rule reads `metadata.pluginRoot` too. The docs say that it must be a relative path inside the
marketplace.[^bare] The rule reports a `pluginRoot` that is a network path, an absolute path, or
contains `..`. The docs set no prefix for it, so the rule does not report a `pluginRoot` that has
no `./`.

This rule checks text only. It reads no file system. It does not check that the directory exists,
and it does not follow symlinks.

When a key appears twice, the rule reads the last, as `JSON.parse` does. A value that is not a
string is a fault for `marketplace-schema`. The rule does not check it. An object `source` is for
`marketplace-source-schema`.

`claude plugin validate` reports a relative path that has `..`, as `Path contains ".."`, and the
docs list `Invalid input` for a path with no `./` prefix.[^validation][^invalid] The docs list no
validate message for an absolute path or a network path. The rule reports those cases, and Claude
Code refuses them when it installs the plugin.[^refusal] The rule does not check a backslash after
the `./` prefix.

Fail:

```json
{
  "name": "acme",
  "owner": { "name": "Acme" },
  "plugins": [{ "name": "formatter", "source": "plugins/formatter" }]
}
```

Pass:

```json
{
  "name": "acme",
  "owner": { "name": "Acme" },
  "metadata": { "pluginRoot": "./plugins" },
  "plugins": [
    { "name": "formatter", "source": "formatter" },
    { "name": "linter", "source": "./tools/linter" }
  ]
}
```

## Options

None.

## Sources

[^sources]: [Marketplace reference: Plugin sources](https://code.claude.com/docs/en/plugins/marketplace-reference#plugin-sources)
[^relative]: [Marketplace reference: Relative path plugin source](https://code.claude.com/docs/en/plugins/marketplace-reference#relative-path-plugin-source)
[^bare]: [Marketplace reference: Bare names under pluginRoot](https://code.claude.com/docs/en/plugins/marketplace-reference#bare-names-under-pluginroot)
[^refusal]: [Error reference: Marketplace entry path does not stay inside the marketplace directory](https://code.claude.com/docs/en/errors#marketplace-entry-path-does-not-stay-inside-the-marketplace-directory)
[^validation]: [Marketplace reference: Validation messages](https://code.claude.com/docs/en/plugins/marketplace-reference#validation-messages)
[^invalid]: [Marketplace reference: Invalid input on a source](https://code.claude.com/docs/en/plugins/marketplace-reference#invalid-input-on-a-source)
