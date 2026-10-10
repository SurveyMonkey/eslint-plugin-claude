---
type: Reference
description: The ESLint rule claude/plugin-evals-replay-committed, which reports a plugin manifest when a .gitignore pattern covers the mocks/.replay directory of its eval suite, or when that directory has files and git tracks none of them, because CI runs then differ.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-evals-replay-committed`

Commit the mocks/.replay directory of an eval suite, and do not ignore it.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude-plugin/plugin.json` |

## Rule details

An agent mock answers with a call to a judge model, so its output varies between runs. A run
that ends with no error saves each answer in `mock-recordings/` under its results directory. The
author copies a saved answer into `mocks/.replay/<server>/`. Later runs answer the same call from
that copy, with no model call. The docs tell the author to commit `mocks/.replay/` with the rest
of `mocks/`, so that CI runs repeat.[^replay]

The rule has two messages. It reports one of them, at the start of the manifest. The message names
the `.replay/` directory from the plugin root.

- **`ignored`:** a `.gitignore` pattern covers `mocks/.replay/` in the eval directory. A pattern
  such as `.replay/`, `mocks/` or `evals/` does this. Git then ignores each new saved answer. The
  rule reports this also when the directory is not there yet.
- **`untracked`:** `mocks/.replay/` has an entry on the disk, and git tracks no file in it.
  A saved answer is there, and no one has committed it. The rule reports this only when no pattern
  covers the directory. If git tracks one file, the rule is silent. It does not check each file. Any entry counts, also a file such as `.DS_Store`.

A pattern counts when it is in a `.gitignore` file of the repository. The file is at the root,
or in a directory above the eval directory. Git reads a pattern with a `/` inside it from the
directory of its `.gitignore`. So `mocks/.replay/` in the root file does not cover
`evals/mocks/.replay/`. The rule does not count two other sources:

- `.git/info/exclude` stays in one clone.
- The global excludes file stays on one machine.

A later pattern that starts with `!` can take the directory back. The rule then makes no
`ignored` report.

The lint target and the eval directory are the same as for
[`plugin-evals-results-gitignored`](plugin-evals-results-gitignored.md): the manifest of the
plugin, and `evals/` or the relative path in `experimental.evals`.[^dir] The rule checks the
`mocks/.replay/` of the suite. A case can have its own `mocks/` directory. The rule does not read
those directories.

The rule makes no report in these cases:

- The manifest is in no plugin root, or the plugin has no eval directory.
- `mocks/` or `.replay` is a link. Git refuses a path behind a link, so the rule cannot answer.
  This holds for a link to a place in the repository too.
- The eval directory is a link to a place out of the repository (ADR 001, Decision 14).
- The rule cannot read git. There is no `.git` entry at or above the manifest. `git` is not
  installed, or a `git` command fails. A `.git` entry that is not a repository lies inside
  another repository.

Fail: `.gitignore` with `.replay/`, in a repository with an eval suite. Fail: a plugin with
`evals/mocks/.replay/github/answer.md` that git does not track.

Pass: the same plugin after `git add evals/mocks/.replay`, with no pattern for it.

## Options

None.

## Sources

[^replay]: [Test plugins with evals: Replay agent mock answers](https://code.claude.com/docs/en/plugin-evals#replay-agent-mock-answers)
[^dir]: [Test plugins with evals: Use a different eval directory](https://code.claude.com/docs/en/plugin-evals#use-a-different-eval-directory)
