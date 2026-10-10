---
type: Reference
description: The ESLint rule claude/permissions-auto-mode-dropped-allow, a heuristic that reports an allow rule that auto mode drops, such as a wildcarded interpreter, Agent or Monitor, because the classifier reviews the action in its place, unless the settings source turns auto mode off.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-auto-mode-dropped-allow`

Do not rely on an `allow` rule that auto mode drops.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule reads no hidden drop-in in `managed-settings.d`, because Claude Code ignores it.

## Rule details

When a session enters auto mode, Claude Code drops the broad `allow` rules that grant arbitrary code execution.[^dropped]
The classifier reviews each action in their place. Claude Code restores the rules when the session leaves auto mode.[^dropped]
The rule reports these `allow` rules:

- A wildcarded interpreter: the program `python` with only a `*` after it. Examples are `Bash(python*)`,
  `Bash(python *)` and `Bash(python:*)`.[^dropped] The option `interpreters` adds programs to this list. A `PowerShell` rule gets
  the same check, because `autoMode.classifyAllShell` names both shell tools.[^classify]
- Every `Agent` allow rule.
- Every `Monitor` allow rule, because Claude Code runs Monitor commands through the shell.[^dropped] Before v2.1.236, Claude Code
  kept `Monitor` allow rules in effect in auto mode. The rule has no version option, so it reports them on every version.[^dropped]

A narrow rule such as `Bash(npm test)` stays in effect in auto mode, and gets no report.[^dropped] The option
`autoMode.classifyAllShell` makes the classifier review the narrow rules too.[^classify] The rule does not check that option.

### Limits

Auto mode is a runtime choice. No file shows that a session runs in auto mode, so the rule is a heuristic. It reports the
rules that the docs name, and it reads these facts from the files:

- It makes no report when the settings source sets `disableAutoMode` to `"disable"`, at the top level or in `permissions`.
  Auto mode then never runs.[^key] In managed settings, any value but `null` counts, at both places. Claude Code reads it as
  `"disable"` on v2.1.282 and later.[^lock]
- It makes no report when a file of the same source cannot be read, because that file can hold the lock. The source is the
  project pair, or the merged managed files. A lock in one file counts, even if another file of the source sets the key
  to another value.

The rule does not check these cases:

- A package-manager run command and a shell-wrapper prefix. The docs name the classes and give no list of commands.
- An interpreter that is not `python` or in the option `interpreters`, and a rule with more words, such as
  `Bash(python -m pytest *)`.
- The `permissions.defaultMode` of the file. A session can enter auto mode with Shift+Tab or a flag, whatever the file sets.
- A rule in a user file, which the repository does not hold. A `disableAutoMode` lock in a user file is also not visible.

### One report for one fault

[`permissions-allow-unrestricted`](permissions-allow-unrestricted.md) reports `Bash(*)`, `PowerShell(*)` and the bare names
`Bash` and `PowerShell`. It reports that the rule approves every command. Auto mode drops these rules too, but this rule skips
them, so one rule gets one report.

Fail:

```json
{
  "permissions": {
    "allow": ["Bash(python*)", "Agent"]
  }
}
```

Pass:

```json
{
  "permissions": {
    "allow": ["Bash(python -m pytest)"]
  }
}
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `interpreters` | `[]` | Extra program names, as an array of unique non-empty strings. The rule reports a wildcarded rule for each of them, and for `python`. |

```js
"claude/permissions-auto-mode-dropped-allow": ["warn", { interpreters: ["node", "ruby"] }]
```

## Sources

[^dropped]: [Choose a permission mode: How auto mode evaluates actions](https://code.claude.com/docs/en/permission-modes#how-auto-mode-evaluates-actions)
[^classify]: [Configure auto mode: Route all shell commands through the classifier](https://code.claude.com/docs/en/auto-mode-config#route-all-shell-commands-through-the-classifier)
[^key]: [All settings: disableAutoMode](https://code.claude.com/docs/en/settings-reference#disableautomode)
[^lock]: [Deploy managed settings: Keys that fail closed](https://code.claude.com/docs/en/managed-settings#keys-that-fail-closed)
