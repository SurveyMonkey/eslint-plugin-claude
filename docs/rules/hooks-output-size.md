---
type: Reference
description: The ESLint rule claude/hooks-output-size, a heuristic that reports a literal additionalContext, systemMessage, initialUserMessage or plain stdout of a hook over 10,000 characters, or a classifierContext note over 2,000 characters, with the options maxOutputChars and maxClassifierChars.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# `hooks-output-size`

Keep the context that a hook prints under the output caps.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | limit | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

Claude Code caps the strings `additionalContext`, `systemMessage` and `initialUserMessage` of a hook, and its plain
stdout, at 10,000 characters. It measures each string on its own. Over the cap, it saves the output to a file in the
session directory, and passes Claude the file path with a preview of up to the first 2,000 characters. It does not ask
Claude to read the file. "This cap has no setting or environment variable to raise it."[^json-output][^add-context]
Plain stdout is added to the context on `UserPromptSubmit`, `UserPromptExpansion`, `SessionStart` and
`PostModelSwitch`.[^exit-0]

Claude Code also caps the `classifierContext` notes of one tool call at 2,000 characters, and truncates the rest.[^classifier]
The cap is shared across every hook that responds to that call. The rule cannot add the notes of several hooks, so it
measures each string on its own. A string over the cap proves a cut.

The rule reads the strings of a JSON object that a command prints as a literal. It reads each field at the top level
and inside `hookSpecificOutput`. On the four events above, it also measures a literal `echo` or `printf` text that is
no JSON object. The length is `String.length`, which counts UTF-16 code units.

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

Fail, with a script that prints a `systemMessage` of 10,001 characters.

Pass: the same script with a shorter message.

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/hooks-output-size': 'warn'
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `maxOutputChars` | `10000` | The limit on `additionalContext`, `systemMessage`, `initialUserMessage` and plain stdout. Optional. |
| `maxClassifierChars` | `2000` | The limit on a `classifierContext` note. Optional. |

```js
'claude/hooks-output-size': ['warn', { maxOutputChars: 4000, maxClassifierChars: 500 }]
```

The defaults are the caps of Claude Code. The docs say that no setting raises the output cap. The schema also allows no value above the
2,000 of the classifier cap (`maximum`). A team can set a lower value to keep the context short. A config that sets only the severity keeps the
defaults. The `recommended` and `strict` configs set no option.

At the default, the message says that Claude Code caps the string. At another value, the message says "The configured
limit is 4000", and claims no cut.

## Sources

[^json-output]: [Hooks reference: JSON output](https://code.claude.com/docs/en/hooks#json-output)
[^add-context]: [Hooks reference: Add context for Claude](https://code.claude.com/docs/en/hooks#add-context-for-claude)
[^exit-0]: [Hooks reference: Exit code 0](https://code.claude.com/docs/en/hooks#exit-code-0)
[^classifier]: [Hooks reference: Annotate a result for the auto mode classifier](https://code.claude.com/docs/en/hooks#annotate-a-result-for-the-auto-mode-classifier)
