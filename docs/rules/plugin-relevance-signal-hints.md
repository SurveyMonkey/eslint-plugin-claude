---
type: Reference
description: The ESLint rule claude/plugin-relevance-signal-hints, which reports a cli signal entry of a marketplace relevance block that has white space, and a manifestDeps file pattern that starts with a caret, because neither can match, with examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# claude/plugin-relevance-signal-hints

📝 Write a relevance cli entry as one command name, and a file pattern with an end anchor.

⚠️ This rule _warns_ in the 🔒 `strict` config.

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| no-op | `**/.claude-plugin/marketplace.json` |

## Rule details

A plugin entry of `marketplace.json` can have a `relevance` block. Claude Code tests its signals
against the session. Two signals have a hint in the docs. The rule is a heuristic, so it is `off` in
`recommended`.

**`cli`.** Claude Code records one command name for each shell command that Claude runs. The name
is the first token after any leading environment variable assignments and `sudo`.[^command] A `cli`
entry is an exact match.[^fields] An entry with white space, such as `terraform plan`, is more than
one token, so it never matches. The rule reports each `cli` entry that has a space, a tab or
another white space character. Write the command name only: `terraform`.

**`manifestDeps`.** The `file` value is a regular expression. Claude Code matches it against the
path of the manifest file. The path is typically absolute, so the docs say to anchor the pattern at
the end and not at the start.[^deps] The rule reports a `file` pattern that starts with `^`. The
docs give the form `[/\\\\]package\\.json$` for `package.json`.

The rule checks less than the row of the inventory. The docs ask for an anchor at the end, but they
do not require `$`. A pattern with no anchor still matches. So the rule does not report a missing
`$`. It also does not read the `pattern` value, which Claude Code matches against file content.

The rule makes no report for a value of the wrong shape. A `relevance` value that is not an object,
`signals` that is not an object, a `cli` that is not an array, and an entry or a `file` that is not a
string get no report. `claude plugin validate` and `marketplace-schema` own those faults. The rule
reads the entries of the linted `marketplace.json` and no other file.

Fail: `"signals": { "cli": ["terraform plan"] }`.

Pass: `"signals": { "cli": ["terraform"] }`.

Fail: `"manifestDeps": [{ "file": "^package\\.json$", "pattern": "\"your-sdk\"" }]`.

Pass: `"manifestDeps": [{ "file": "[/\\\\]package\\.json$", "pattern": "\"your-sdk\"" }]`.

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/plugin-relevance-signal-hints': 'warn'
```

## Sources

[^command]: [Recommend plugins for your org: Command name matching](https://code.claude.com/docs/en/plugins/relevance#command-name-matching)
[^fields]: [Recommend plugins for your org: relevance.signals](https://code.claude.com/docs/en/plugins/relevance#relevance-signals)
[^deps]: [Recommend plugins for your org: Manifest dependency matching](https://code.claude.com/docs/en/plugins/relevance#manifest-dependency-matching)
