---
type: Reference
description: The ESLint rule claude/permissions-auto-mode-push-ask, a heuristic that reports a managed settings source that sets defaultMode to auto and holds no ask or deny rule for git push, because auto mode pushes to most branches of the repository without a prompt.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-auto-mode-push-ask`

Add an `ask` rule for `git push` where a managed file turns on auto mode.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule is `off` in `recommended`. It is a heuristic, so `strict` turns it on at `warn`.
The rule reads no hidden drop-in in `managed-settings.d`, because Claude Code ignores it.

## Rule details

By default, auto mode allows pushes to the branches of the repository you work in, and pull request creation.[^common] A branch with a deploy name, such as `production`, is an exception. An `ask`
rule with a command, such as `Bash(git push *)`, is evaluated before the classifier, and always forces a prompt, even in auto
mode.[^checkpoint] A `deny` rule blocks before the classifier too.[^checkpoint]

A file does not show that a session runs in auto mode, because auto mode is the built-in start mode of terminal sessions on
recent versions.[^start] The rule reads the one place where a file turns it on and the value takes effect: `permissions.defaultMode`
set to `"auto"` in a managed file. The value has no effect in `.claude/settings.json` and `.claude/settings.local.json`.[^start]
[`permissions-default-mode-project-ignored`](permissions-default-mode-project-ignored.md) reports it there, so this rule does not
read those files.

The rule reports the `defaultMode` value when the managed source holds no rule that matches a push. A rule matches when it is in
`ask` or `deny`, for `Bash` or `PowerShell`, and its pattern matches `git push origin main` by the wildcard rules of the
docs.[^wildcard] These match: `Bash(git push *)`, `Bash(git push:*)`, `Bash(git *)`, `Bash(*)` and the bare tool name. `Bash(git push)`
does not, because it matches the bare command only.

### Silent cases

- The managed source locks auto mode off with `disableAutoMode`, at the top level or in `permissions`. The docs
  lock is `"disable"`. A value that Claude Code cannot read also locks, and only `null` removes the key.[^lock]
- A file of the source holds a `hooks.PreToolUse` entry. The docs name a hook as the checkpoint that reads the full command.[^checkpoint]
- Another file of the source sets `defaultMode` to a value other than `auto`. The docs do not say which file wins.
- The rule cannot read a file of the source.

### Limits

A push that Claude writes another way, such as `git -C <dir> push`, does not match the rule, so it is not checkpointed.[^limits]
A user file can hold the `ask` rule, and the repository does not hold it (ADR 001, Decision 14). That is the reason the rule is
`off` in `recommended`.

Fail:

```json
{ "permissions": { "defaultMode": "auto" } }
```

Pass:

```json
{ "permissions": { "defaultMode": "auto", "ask": ["Bash(git push *)"] } }
```

## Options

None.

## Sources

[^common]: [Configure auto mode: Common boundaries](https://code.claude.com/docs/en/auto-mode-config#common-boundaries)
[^checkpoint]: [Configure auto mode: Add a human checkpoint](https://code.claude.com/docs/en/auto-mode-config#add-a-human-checkpoint)
[^start]: [Choose a permission mode: Which mode a session starts in](https://code.claude.com/docs/en/permission-modes#which-mode-a-session-starts-in)
[^wildcard]: [Configure permissions: Wildcard patterns](https://code.claude.com/docs/en/permissions#wildcard-patterns)
[^lock]: [Deploy managed settings: Keys that fail closed](https://code.claude.com/docs/en/managed-settings#keys-that-fail-closed)
[^limits]: [Configure permissions: What a Bash rule doesn't match](https://code.claude.com/docs/en/permissions#bash-rule-limits)
