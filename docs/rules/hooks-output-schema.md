---
type: Reference
description: The ESLint rule claude/hooks-output-schema, a heuristic that reports JSON output of a hook that has a field at the wrong level, a wrong hookEventName, a decision other than block, suppressOutput, a field that PreModelSwitch does not accept, classifierContext from a background hook, or a block for policy_settings.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# claude/hooks-output-schema

📝 Print JSON output that Claude Code reads, with each field at its level.

⚠️ This rule _warns_ in the 🔒 `strict` config.

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

A hook prints a JSON object, and Claude Code reads specific fields from it. A field at the wrong level has no effect. For
`permissionDecision` and `additionalContext`, Claude Code shows no error.[^wrong-level] The rule reads JSON that a
command prints as a literal, and reports these faults at the `command` string.

| Message | Fault |
|---------|-------|
| `level` | `permissionDecision`, `additionalContext` or `updatedInput` at the top level. They belong inside `hookSpecificOutput`. The hooks guide names `permissionDecision` and `additionalContext` only.[^wrong-level][^decision] |
| `eventName` | A `hookSpecificOutput.hookEventName` that is not the event of the hook |
| `eventNameMissing` | A `hookSpecificOutput` with no `hookEventName`. The docs say that it "requires a `hookEventName` field set to the event name".[^json-output] |
| `decision` | A top-level `decision` other than `"block"`. "The only value for `decision` is `"block"`".[^decision] |
| `suppress` | The field `suppressOutput`. It "has no effect: Claude Code accepts the field but doesn't act on it".[^json-output] |
| `modelSwitch` | On `PreModelSwitch`: `permissionDecision` of `"defer"`, `updatedInput` or `additionalContext` in `hookSpecificOutput`. The event does not accept them.[^model-switch] |
| `classifierAsync` | `classifierContext` from a handler with `async` or `asyncRewake`. Claude Code ignores the field in the response of a hook in the background.[^classifier] |
| `policyBlock` | A top-level `decision` of `"block"` in a `ConfigChange` handler whose matcher is exactly `policy_settings`. Claude Code ignores a block for that source.[^config-change] |

The rule reports each fault once for a handler.

### What the other rules own

The top-level `decision` and `reason` of `PreToolUse` are for [`hooks-output-deprecated-fields`](hooks-output-deprecated-fields.md),
so this rule makes no `decision` report on that event. [`hooks-output-size`](hooks-output-size.md) measures the strings
of the fields. [`hooks-broad-auto-approve`](hooks-broad-auto-approve.md) reads the allow decisions.
`claude plugin validate` does not read hook output.

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

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "hooks": [{ "type": "command", "command": "echo '{\"permissionDecision\":\"deny\"}'" }]
      }
    ]
  }
}
```

Pass: the same hook, with `permissionDecision` inside `hookSpecificOutput`, and `hookEventName` set to `PreToolUse`.

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/hooks-output-schema': 'warn'
```

## Sources

[^json-output]: [Hooks reference: JSON output](https://code.claude.com/docs/en/hooks#json-output)
[^wrong-level]: [Automate actions with hooks: Fields at the wrong level](https://code.claude.com/docs/en/hooks-guide#fields-at-the-wrong-level)
[^decision]: [Hooks reference: Decision control](https://code.claude.com/docs/en/hooks#decision-control)
[^model-switch]: [Hooks reference: PreModelSwitch decision control](https://code.claude.com/docs/en/hooks#premodelswitch-decision-control)
[^classifier]: [Hooks reference: Annotate a result for the auto mode classifier](https://code.claude.com/docs/en/hooks#annotate-a-result-for-the-auto-mode-classifier)
[^config-change]: [Hooks reference: ConfigChange decision control](https://code.claude.com/docs/en/hooks#configchange-decision-control)
