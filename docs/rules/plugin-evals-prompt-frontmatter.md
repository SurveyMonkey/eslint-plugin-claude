---
type: Reference
description: The ESLint rule claude/plugin-evals-prompt-frontmatter, which reports an unknown key, a number outside the documented limit, or an env key that does not match EVAL_ in the frontmatter of the prompt.md of an eval case, because Claude Code treats these as errors.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# `plugin-evals-prompt-frontmatter`

Use the documented frontmatter fields, limits and env keys in an eval prompt.md.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/prompt.md` |

## Rule details

The `prompt.md` of an eval case holds the prompt in its body. Its frontmatter sets the case and the
limits of a run. The frontmatter takes 13 fields: `schema_version`, `name`, `description`, `tags`,
`plugins`, `runs`, `expected_outcome`, `model`, `max_turns`, `timeout_seconds`, `allowed_tools`,
`append_system_prompt` and `env`. The docs say that an unknown key is an error.[^fields]

The rule reports these faults:

- An unknown key, on the key. A key that differs from a known key only in case, hyphens or
  underscores, such as `maxTurns`, gets a message that names the known key.
- `runs` below 1 or above 50. The docs give "1 to 50".[^fields]
- `max_turns` above 200, and `timeout_seconds` above 3600. The docs give "up to 200" and "up to
  3600" and no lower bound, so the rule reports no small value.[^fields]
- A key of `env` that does not match `EVAL_[A-Z0-9_]*`, on the value of `env`. The docs say that
  any other key fails the run.[^fields]

The fields of `case.yaml` that `prompt.md` does not take are unknown keys here. These are `context`,
`execution` and `graders`.[^fields]

### Which files the rule reads

The glob is `**/prompt.md`. The rule reads a file only when it is the `prompt.md` of a case in the
eval directory of a plugin. The eval directory is `evals/`, or the path in `experimental.evals` of
the manifest.[^dir] The rule finds the plugin by the nearest `.claude-plugin/plugin.json` above the
file. The walk stops at the repository root. A folder `mocks` or `results` at the top of the eval
directory is no case. A `prompt.md` below a case belongs to that case and is not read. A `graders/`
file or a mock file that is named `prompt.md` is no case file.

The rule makes no report in these cases:

- The file has no frontmatter, or the block does not parse, or it is not a map.
- A number field holds a value that is not a number. The rule checks the limits only.
- The rule cannot see the plugin. The plugin root, the manifest, or the eval directory can be
  missing, or out of the repository (ADR 001, Decision 14). The manifest can fail to parse.
- The repository has no `.git` entry at or above the file. The walk then checks the folder of
  the file only.

`claude plugin validate` passes a `prompt.md` with these faults (checked on Claude Code 2.1.296).

Fail: a `prompt.md` with `max_turn: 5` in its frontmatter.

Pass: a `prompt.md` with `max_turns: 10` and `allowed_tools: [Read, Glob, Grep, Skill]`.

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/plugin-evals-prompt-frontmatter': 'error'
```

## Options

None.

## Sources

[^fields]: [Test plugins with evals: prompt.md frontmatter](https://code.claude.com/docs/en/plugin-evals#prompt-md-fields)
[^dir]: [Test plugins with evals: Use a different eval directory](https://code.claude.com/docs/en/plugin-evals#use-a-different-eval-directory)
