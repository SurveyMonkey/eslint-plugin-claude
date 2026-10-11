---
type: Reference
description: The ESLint rule claude/plugin-evals-grader, which reports a grader file of an eval case with a missing or unknown type, a weight that is not positive, an arm or target or focus that the docs do not list, or an inline (?i) in a regex pattern, because Claude Code cannot load or run such a grader.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# `plugin-evals-grader`

Give an eval grader a valid type, weight, arm, target and focus.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/graders/*.md` |

## Rule details

A grader is a pass or fail check on the result of an eval run. Each file in the `graders/` directory
of a case is one grader. Its frontmatter sets the `type`, and the options of that type.[^frontmatter]

The rule reports these faults:

- No `type`, or a `type` that is not one of `regex`, `tool_used`, `tool_order`, `file_exists`,
  `llm` and `baseline`. The docs say that `type` is required.[^frontmatter][^types] A file with no
  frontmatter gets the first report, at the start of the file.
- A `weight` that is not a positive number. The docs say "Any positive number".[^frontmatter]
- An `arm` other than `with-only` and `both`. The key may be absent.[^frontmatter]
- A `target` of a `regex` grader, or a `focus` of an `llm` grader, that is not `last_message`,
  `trace`, `files`, `mock_calls` or the map `{ source: file, path: <path> }`.[^look]
- A `pattern` of a `regex` grader that has an inline `(?i)`. The docs say "inline `(?i)` isn't
  supported" and ask for `flags: i`.[^types]

The report is on the value. A missing `type` is reported on the frontmatter block, or at the start of the file. The rule reports each fault of a file.
An empty value, such as `weight:`, is the same as an absent key.

The rule reads `target` for a `regex` grader and `focus` for an `llm` grader, as the docs do. It does
not read the other options of the types (`tool`, `input_match`, `min`, `max`, `before`, `after`,
`path`, `exists`, `criteria` and `baseline_file`). It reads the grader files only, and not the
`graders:` list of a `case.yaml`.

### Which files the rule reads

The glob is `**/graders/*.md`. The rule reads a file only when it sits directly in the `graders/`
directory of a case in the eval directory of a plugin. A case is a directory with a `prompt.md` or
a `case.yaml`. The eval directory is `evals/`, or the path in `experimental.evals` of the
manifest.[^dir] The rule finds the plugin by the nearest `.claude-plugin/plugin.json` above the file.
The walk stops at the repository root. The rule makes no report in these cases:

- The file is in a folder below `graders/`, or in a `graders/` directory that is not in a case.
- The frontmatter block does not parse, or it is not a map.
- The rule cannot see the plugin. The plugin root, the manifest, or the eval directory can be
  missing, or out of the repository (ADR 001, Decision 14). The manifest can fail to parse.
- The repository has no `.git` entry at or above the file. The walk then checks the folder of
  the file only.

`claude plugin validate` passes a grader with these faults (checked on Claude Code 2.1.296).

Fail: a grader with `type: contains` in its frontmatter.

Pass: a grader with `type: regex`, `pattern: hello` and `flags: i`.

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/plugin-evals-grader': 'error'
```

## Options

None.

## Sources

[^frontmatter]: [Test plugins with evals: Grader frontmatter](https://code.claude.com/docs/en/plugin-evals#grader-frontmatter)
[^look]: [Test plugins with evals: What a grader can look at](https://code.claude.com/docs/en/plugin-evals#what-a-grader-can-look-at)
[^types]: [Test plugins with evals: Grader types](https://code.claude.com/docs/en/plugin-evals#grader-types)
[^dir]: [Test plugins with evals: Use a different eval directory](https://code.claude.com/docs/en/plugin-evals#use-a-different-eval-directory)
