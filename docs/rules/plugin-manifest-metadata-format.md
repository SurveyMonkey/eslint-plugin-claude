---
type: Reference
description: The ESLint rule claude/plugin-manifest-metadata-format, which reports a plugin.json whose license is not an SPDX license expression or whose repository is not a URL, because Claude Code checks neither, with examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-manifest-metadata-format`

Set the `license` of `plugin.json` to an SPDX license expression, and the `repository` to a URL.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude-plugin/plugin.json` |

## Rule details

The manifest reference says that `license` is an SPDX identifier such as `MIT` or `Apache-2.0`.
It says that `repository` is the URL of the source repository, and that Claude Code does not
validate it.[^fields] `claude plugin validate` on Claude Code 2.1.296 accepts `"license": "bogus"`
and `"repository": "nope"`. It reports only a value that is not a string. So this rule checks the
form of the two strings.

The rule reports the value of `license` when a name in it is not in the SPDX License List.[^spdx]
It reports the value of `repository` when the text does not parse as a URL.

How the rule reads a `license`:

- It splits the text at spaces and parentheses. `AND`, `OR` and `WITH` are operators.
- Each other part is a name. A name after `WITH` is a license exception. Any other name is a
  license identifier, and it can end in `+`.
- The match of a listed name ignores case, as SPDX says. An operator must be in uppercase. The
  prefixes `DocumentRef-`, `LicenseRef-` and `AdditionRef-` are case-sensitive.
- A name of the form `LicenseRef-<id>`, where `<id>` has only letters, digits, `.` and `-`, is a
  license that the author defines. A `DocumentRef-<id>:` prefix is allowed. It is not valid after
  `WITH`.
- After `WITH`, a name of the form `AdditionRef-<id>` is an exception that the author defines. A
  `DocumentRef-<id>:` prefix is allowed. Only SPDX 3.0 has this form: SPDX 2.3 allows only a
  listed exception.
- A text with no name is not valid.

The rule checks the names, and not the shape of the expression. So `MIT Apache-2.0` and
`MIT AND` give no report. The npm values `UNLICENSED` and `SEE LICENSE IN <file>` are not SPDX,
so the rule reports them. Use a `LicenseRef-` name for a license that SPDX does not list.

The list of identifiers is in `src/data/spdx-licenses.ts`. It is the SPDX License List 3.29.0 of
2026-09-16, with the deprecated identifiers. A new SPDX release adds identifiers. A valid new
identifier gets a report until the list is updated.

The rule makes no report in these cases:

- The value of `license` or `repository` is not a string. `claude plugin validate` reports a
  value of the wrong type.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of
  the plugin root, of `.claude-plugin/` or of `plugin.json` can be out of the repository. The
  manifest can fail to parse.

The rule does not check `homepage`. The docs say that a `homepage` that is not a URL makes the
plugin fail to load.[^fields] The rule
`plugin-manifest-publish-metadata` checks that `homepage` and `repository` are set.

A URL, to this rule, is any text that the WHATWG URL parser accepts with no base. So
`github.com/acme/tool`, `acme/tool` and `git@github.com:acme/tool.git` are not URLs. Use
`https://github.com/acme/tool`.

When a key appears twice, the rule reads the last one, as `JSON.parse` does.

Fail: `"license": "bogus"`, `"license": "MIT OR bogus"`, `"repository": "acme/tool"`.

Pass: `"license": "MIT"`, `"license": "(MIT OR Apache-2.0)"`,
`"repository": "https://github.com/acme/tool"`.

## Options

None.

## Sources

[^fields]: [Plugin manifest reference: Fields](https://code.claude.com/docs/en/plugins/manifest-reference#fields)
[^spdx]: [SPDX License List](https://spdx.org/licenses/)
