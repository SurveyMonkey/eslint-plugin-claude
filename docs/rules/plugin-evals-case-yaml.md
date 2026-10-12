---
type: Reference
description: The ESLint rule claude/plugin-evals-case-yaml, which reports a plugin manifest when a case.yaml in the eval suite of the plugin has no schema_version of 1.1, has no name, or names a scaffold script, history file or added directory that is not inside the case directory.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# claude/plugin-evals-case-yaml

📝 Give a case.yaml its schema_version and name, and keep its paths in the case.

💼 This rule is enabled in the following configs: ✅ `recommended`, 🔒 `strict`.

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| load | `**/.claude-plugin/plugin.json` |

## Rule details

A `case.yaml` describes an eval case in YAML. It "requires `schema_version: "1.1"` and `name`".[^fields]
It can also set `context.scaffold_script`, `context.history_file` and `context.add_dirs`. The docs
describe each as a file or directories in the case directory.[^fields][^seed]

The lint target is the manifest, `.claude-plugin/plugin.json`. ESLint has no YAML language, and
the plugin adds no dependency for one. The rule reads the `case.yaml` files of the eval directory
with the `yaml` package. It reports at the start of the manifest, and each message names the file.

The rule reports these faults, for each `case.yaml`:

- No `schema_version`, or an empty one.
- A `schema_version` other than `1.1`. The message shows the value as it is written. The rule
  accepts the string `"1.1"` and the number `1.1`, because the docs do not say that Claude Code
  refuses the number.
- No `name`, an empty `name`, or a `null` one.
- A path in `context.scaffold_script`, `context.history_file`, or an entry of `context.add_dirs`
  that is not inside the case directory. This covers an absolute path, a `..` segment that leaves
  the directory, and a link that leaves it for a place in the repository.
- A path in these keys that is inside the case directory, and that names nothing. The rule reports
  an add_dirs entry in the same way. It does not check if the path is a file or a directory.

A case is a directory that holds a `prompt.md` or a `case.yaml`. The eval directory is `evals/`, or
the path in `experimental.evals`.[^dir] A directory below a case belongs to that case. The rule
skips the directories `mocks` and `results` at the top of the eval directory, and `.git` and
`node_modules`. It does not enter a link to a directory.

The rule does not report these:

- A case without a grader. The docs say that such a case fails to load, and the rule does not read
  the `graders` list of a `case.yaml` or the `graders/` directory.[^layout]
- The other keys of `case.yaml`, such as `tags`, `execution` and `graders`.
- A `name` that is not a string, and a path that is not a string.

The rule makes no report in these cases:

- The manifest is in no plugin root, or the eval directory is not there.
- The eval directory, the plugin root or a `case.yaml` is a link out of the repository, or a link
  with no target (ADR 001, Decision 14). A part of a context path that is a link out of the
  repository, or a link with no target, gets no report either.
- A `case.yaml` cannot be read, is not a regular file, is larger than 1 MiB, does not parse, repeats
  a key, is not a map, or holds an alias with no anchor or more than 100 aliases.
- A case directory cannot be listed.

`claude plugin validate` passes a plugin with these faults (checked on Claude Code 2.1.296).

Fail: a `case.yaml` with `name: first` and no `schema_version`.

Pass: a `case.yaml` with `schema_version: "1.1"` and `name: first`.

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/plugin-evals-case-yaml': 'error'
```

## Sources

[^fields]: [Test plugins with evals: case.yaml fields](https://code.claude.com/docs/en/plugin-evals#case-yaml-fields)
[^seed]: [Test plugins with evals: Seed the workspace or conversation](https://code.claude.com/docs/en/plugin-evals#add-setup-or-history-with-case-yaml)
[^layout]: [Test plugins with evals: Eval suite reference](https://code.claude.com/docs/en/plugin-evals#eval-suite-reference)
[^dir]: [Test plugins with evals: Use a different eval directory](https://code.claude.com/docs/en/plugin-evals#use-a-different-eval-directory)
