---
type: Reference
description: The ESLint rule claude/plugin-evals-dir, which reports an experimental.evals value in a plugin manifest that is not a relative path of plain directory names, because Claude Code then prints a warning and uses the evals directory.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-evals-dir`

Write experimental.evals as a relative path of plain directory names.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude-plugin/plugin.json` |

## Rule details

A plugin can keep its eval suite in a directory other than `evals/`. It sets the directory in
`experimental.evals` of the manifest, for example `"experimental": { "evals": "quality/evals" }`.[^dir]
The docs accept a relative path of plain directory names, such as `qa` or `quality/evals`. For an
unusable value, `claude plugin eval` prints a `Warning:` line and uses `evals/`. So the eval
directory that the author wrote is not the one that runs.[^dir]

The rule reports the value of `experimental.evals`, on the value. These values get a report:

- A path that is absolute, or that has a drive letter.
- A path that has a `..` segment, a `.` segment, an empty segment, or a backslash.
- An empty string.
- A value that is not a string.

The rule reads the value that `JSON.parse` keeps when the key occurs twice. The docs say that an
absolute path, or a path with `..`, is not accepted. The other values are "unusable" in the same
sense: the docs name a relative path of plain directory names as the only form that they give.[^dir]
The rule uses the same test as `plugin-evals-results-gitignored`, which falls back to `evals/` for
the same values.

The rule makes no report in these cases:

- The key is absent, or `experimental` is not an object.
- The path is a relative path of plain directory names. The rule does not check that the directory
  exists.
- A command-line flag sets the directory. The flag `--eval-dir` wins over the manifest, and the
  rule cannot see a flag.[^dir]

`claude plugin validate` passes such a value (checked on Claude Code 2.1.296).

Fail: `{ "name": "p", "experimental": { "evals": "../x" } }`.

Pass: `{ "name": "p", "experimental": { "evals": "quality/evals" } }`.

## Options

None.

## Sources

[^dir]: [Test plugins with evals: Use a different eval directory](https://code.claude.com/docs/en/plugin-evals#use-a-different-eval-directory)
