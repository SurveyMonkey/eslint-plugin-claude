---
type: Reference
description: The ESLint rule claude/plugin-evals-results-gitignored, which reports a plugin manifest when the plugin has an eval directory and no .gitignore pattern of the repository covers its results directory, because each eval run writes there.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-evals-results-gitignored`

Cover the results directory of an eval suite with a .gitignore pattern.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude-plugin/plugin.json` |

## Rule details

`claude plugin eval` writes each run to `results/<timestamp>/` in the eval directory of the
plugin. The directory holds `aggregate-result.json`, `report.html` and the saved answers of agent
mocks. The docs tell the author to add `results/` to `.gitignore`.[^suite]

The lint target is the manifest, `.claude-plugin/plugin.json`. ESLint has no JSON language
for a file in the eval directory. The `results/` directory is not in a fresh clone. Each plugin has one
manifest, so the rule runs once for each plugin. It reports one message, at the start of the
manifest. The message names the `results/` directory from the plugin root.

The eval directory is `evals/`. A plugin can set another directory in `experimental.evals`
of the manifest, for example `quality/evals`.[^dir] The docs accept a relative path of plain
directory names. An absolute path, or a path with `..`, prints a `Warning:` line, and the run uses
`evals/`. The rule prints no warning, and it uses `evals/` as well. A value that is not a string, an
empty segment, a segment `.`, a backslash and a drive letter give `evals/` too.

The rule asks `git check-ignore` about a directory in `results/`. A pattern counts when it is in
a `.gitignore` file of the repository. The file is at the root, or in a directory above the
results directory. A pattern for files, such as `*.json`, does not cover a directory. The rule does not
count two other sources:

- `.git/info/exclude` stays in one clone.
- The global excludes file stays on one machine.

A later pattern that starts with `!` can take the directory back. The rule then reports.

The rule makes no report in these cases:

- The manifest is in no plugin root.
- The plugin has no eval directory, or the path is a file. The rule does not report a directory
  that `experimental.evals` names and that is not there.
- The eval directory is a link to a place out of the repository (ADR 001, Decision 14).
  The same holds for a link to a place that is not there. The rule reads a link to a directory of the repository where
  it leads. A pattern must then cover the target.
- The rule cannot read git. There is no `.git` entry at or above the manifest. `git` is not
  installed, or a `git` command fails. A `.git` entry that is not a repository lies inside
  another repository.

Fail: a plugin with `evals/first/prompt.md`, in a repository whose `.gitignore` has no pattern for
`evals/results/`.

Pass: the same plugin with `evals/results/` in `.gitignore`.

## Options

None.

## Sources

[^suite]: [Test plugins with evals: Eval suite reference](https://code.claude.com/docs/en/plugin-evals#eval-suite-reference)
[^dir]: [Test plugins with evals: Use a different eval directory](https://code.claude.com/docs/en/plugin-evals#use-a-different-eval-directory)
