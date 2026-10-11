---
type: Reference
description: The ESLint rule claude/permissions-auto-mode-rule-syntax, a heuristic that reports an autoMode entry in a managed file that has the form of a permission rule such as Bash(git push *), because the classifier reads each entry as prose and not as a tool pattern.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# `permissions-auto-mode-rule-syntax`

Write `autoMode` entries as prose, and put a permission rule in `permissions`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | no-op | `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule is `off` in `recommended`. It is a heuristic, so `strict` turns it on at `warn`.
The rule reads no hidden drop-in in `managed-settings.d`, because Claude Code ignores it.

## Rule details

The entries of `autoMode.environment`, `allow`, `soft_deny` and `hard_deny` are prose. The docs say "Entries are prose, not regex
or tool patterns. The classifier reads them as natural-language rules."[^prose] For a hard block by tool pattern, the docs point
to `permissions.deny`.[^override]

The rule reports a string entry that parses as a permission rule: a tool name, then a specifier in parentheses, and nothing
after the closing parenthesis. The tool name must be one that a rule can hold: a tool of the tools reference, `Task`,
`MultiEdit`, `Cd`, or a name that starts with `mcp__`. The entry `Bash(git push *)` fits. A prose entry does not fit, even when it holds
parentheses or a command in code marks: its text before the first `(` has white space, or text follows the closing parenthesis. The built-in rules of `claude auto-mode defaults` are such prose.

The message gives the fix for every list. The rule belongs in `permissions.allow`, `permissions.ask` or `permissions.deny`, and a
sentence takes its place in `autoMode`.

The rule is a heuristic. The classifier is a model, and it may read an entry of this form as an intent. The docs say that it reads
prose, so the form is a probable mistake.

### Where the rule reads

The classifier reads `autoMode` from user settings, managed settings and the `--settings` flag. It does not read it from
`.claude/settings.json` or `.claude/settings.local.json`.[^where] `settings-key-scope` reports the key in those files, so this
rule reads managed files only. A user file is outside the repository (ADR 001, Decision 14).

Fail:

```json
{ "autoMode": { "allow": ["Bash(git push *)"] } }
```

Pass:

```json
{
  "autoMode": { "allow": ["Pushing to the staging remote is allowed"] },
  "permissions": { "ask": ["Bash(git push *)"] }
}
```

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/permissions-auto-mode-rule-syntax': 'warn'
```

## Options

None.

## Sources

[^prose]: [Configure auto mode: Define trusted infrastructure](https://code.claude.com/docs/en/auto-mode-config#define-trusted-infrastructure)
[^override]: [Configure auto mode: Override the block and allow rules](https://code.claude.com/docs/en/auto-mode-config#override-the-block-and-allow-rules)
[^where]: [Configure auto mode: Where the classifier reads configuration](https://code.claude.com/docs/en/auto-mode-config#where-the-classifier-reads-configuration)
