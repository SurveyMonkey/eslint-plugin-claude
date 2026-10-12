---
type: Reference
description: The ESLint rule claude/hooks-multiple-updatedinput, a heuristic that reports a PreToolUse handler that prints updatedInput when an earlier handler of the same file does so for the same tool, because the last hook to finish wins.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# claude/hooks-multiple-updatedinput

📝 Let one PreToolUse hook rewrite the input of a tool.

⚠️ This rule _warns_ in the 🔒 `strict` config.

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| consistency | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

When several `PreToolUse` hooks return `updatedInput`, "the last one to finish takes effect. Since hooks run in
parallel, the order is non-deterministic. Avoid having more than one hook modify the same tool's input."[^limits]
`updatedInput` sits directly under `hookSpecificOutput` and replaces the whole input object of the tool.[^pretooluse]

The rule is a heuristic. It reads the handlers of one file. It reports a handler that prints
`hookSpecificOutput.updatedInput` as a literal, when an earlier handler of the file does so too, and a tool exists that
both matchers select. It reports at the `command` string of the later handler. A file that is a different source
(another settings file, a plugin) is a different scope, and the rule does not compare them.

The check for "the same tool" goes tool by tool. The candidates are the tools that the two matchers name, and the built-in tools
of `src/data/tool-names.ts`. A missing, empty or `*` matcher selects every tool. A matcher of exact names selects those
names. Any other matcher is a regular expression that the rule runs with `RegExp.prototype.test`, as Claude Code does. A tool that both select is the proof. If a regular expression names no known tool, the rule is silent.

The rule skips a handler with an `if` condition, because that handler may run for other calls than the other one. It
skips a handler in the background. It skips a group whose `matcher` is not a string
(`hooks-config-schema` reports that). The `updatedInput` of `PermissionRequest` sits inside `decision` and is out of
scope.

A script that builds its JSON with a tool such as `jq -n` is not read, so the rule makes no report for it.

### JSON that the rule reads

The rule reads JSON that an `echo` or `printf` command prints to standard output, as one argument that is a JSON
object. It ignores JSON that goes to stderr or a file, and JSON that a pipe or a command substitution takes. It reads no JSON that a tool builds, such as `jq -n`, and no
here-document. A script can print JSON at run time that the text does not show, so the rule reports what the text
proves.

### What the rule reads

The rule reads the inline `command` (and an exec-form `command` with its `args`) and the repository scripts that the
command runs. A script is the command word, or the script of `bash`, `sh` or `zsh`, when the path starts with
`${CLAUDE_PROJECT_DIR}` or `${CLAUDE_PLUGIN_ROOT}`, as [`hooks-script-shebang`](hooks-script-shebang.md) resolves it.
The output of a script at run time is not in a file, so the rule reads what the text shows. It reads the simple
commands of the text. It skips a script of another language (by its extension or its shebang), a binary file, a
handler with `shell: "powershell"` and no `args`, and a file that it cannot read inside the repository: a missing
file, a folder, a FIFO, a link with no target, a link that leads out of the repository, a file that is not readable,
and a file of more than one megabyte (ADR 001, Decision 14).

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, and no plugin agent.

Fail, in `.claude/settings.json`: two groups for `Bash`, and the command of each prints a different `updatedInput`.

Pass: one hook rewrites the input, or the matchers select different tools.

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/hooks-multiple-updatedinput': 'warn'
```

## Sources

[^limits]: [Automate actions with hooks: Limitations](https://code.claude.com/docs/en/hooks-guide#limitations)
[^pretooluse]: [Hooks reference: PreToolUse decision control](https://code.claude.com/docs/en/hooks#pretooluse-decision-control)
