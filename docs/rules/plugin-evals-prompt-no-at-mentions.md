---
type: Reference
description: The ESLint rule claude/plugin-evals-prompt-no-at-mentions, which reports an @path mention in the body of the prompt.md of an eval case, because Claude Code does not expand it into a file attachment.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# `plugin-evals-prompt-no-at-mentions`

Do not write an @path mention in the body of an eval prompt.md.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/prompt.md` |

## Rule details

Claude receives the body of an eval `prompt.md` exactly as it is written. An `@path` mention in it
is not expanded into a file attachment. If Claude needs to read a file, the case must grant a tool
for it in `allowed_tools`.[^limits]

The rule reports each `@path` mention in the body, on the mention. A mention is an `@` at the start
of the text or after white space, with a path after it. The path ends at white space or a backtick. A `\` before a space keeps the space in the path. A path that starts with a quote is no mention. The rule reads the mention in the same way as
the import rules for instruction files. It skips code spans, fenced code blocks, and HTML
comments. It reads the body only, so an `@` in the frontmatter gets no report. The end marks of a
sentence, such as `.` and `,`, are not part of the path.

The docs do not say what an `@` token is, so the rule cannot tell a path from a name. A mention
such as `@alice` gets a report, because it has the form of a path. Write the name in a code span to
stop the report.

### Which files the rule reads

The glob is `**/prompt.md`. The rule reads a file only when it is the `prompt.md` of a case in the
eval directory of a plugin. The eval directory is `evals/`, or the path in `experimental.evals` of
the manifest.[^dir] The rule finds the plugin by the nearest `.claude-plugin/plugin.json` above the
file. The walk stops at the repository root. The rule makes no report in these cases:

- The file is a grader, a mock, or a `prompt.md` that is no case of an eval directory.
- The rule cannot see the plugin. The plugin root, the manifest, or the eval directory can be
  missing, or out of the repository (ADR 001, Decision 14). The manifest can fail to parse.
- The repository has no `.git` entry at or above the file. The walk then checks the folder of
  the file only.

`claude plugin validate` passes a `prompt.md` with a mention (checked on Claude Code 2.1.296).

Fail: a `prompt.md` whose body is `Summarize @src/app.ts for me.`

Pass: a `prompt.md` whose body is `Summarize the file src/app.ts for me.`, with `allowed_tools:
[Read]` in the frontmatter.

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/plugin-evals-prompt-no-at-mentions': 'error'
```

## Options

None.

## Sources

[^limits]: [Test plugins with evals: Set run limits and tools in prompt.md](https://code.claude.com/docs/en/plugin-evals#set-run-limits-and-tools-in-prompt-md)
[^dir]: [Test plugins with evals: Use a different eval directory](https://code.claude.com/docs/en/plugin-evals#use-a-different-eval-directory)
