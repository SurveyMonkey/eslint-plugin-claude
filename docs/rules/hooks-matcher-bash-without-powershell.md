---
type: Reference
description: The ESLint rule claude/hooks-matcher-bash-without-powershell, which reports a tool event matcher that selects Bash and not PowerShell, because a Bash-only hook does not fire on a PowerShell call on Windows.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-matcher-bash-without-powershell`

Match PowerShell wherever a tool hook matches Bash.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

On Windows, Claude Code can run shell commands through the PowerShell tool. Without Git Bash, it does not
register the Bash tool at all. A hook that matches only `Bash` does not fire on a PowerShell call. The docs say to match
`Bash|PowerShell` in a hook that inspects shell commands.[^hooks][^tools]

The rule reads the `matcher` of a group under `PreToolUse`, `PostToolUse`, `PostToolUseFailure`,
`PermissionRequest` and `PermissionDenied`. It reports a matcher that selects `Bash` and does not select
`PowerShell`.

- A matcher with exact-match characters only is a list of tool names.[^patterns] The rule reports a list that has
  `Bash` and not `PowerShell`.
- Any other matcher is a regular expression. The rule tests it on `Bash` and on `PowerShell`. It reports
  `^Bash$` and `Bash.*`. It makes no report for `.*`, which selects both. A matcher that is not a valid regular
  expression selects nothing here, and [`hooks-matcher-syntax`](hooks-matcher-syntax.md) reports it.
- The rule makes no report for an omitted, empty or `*` matcher, which selects every tool. It makes none for
  `bash` in lower case, which [`hooks-matcher-never-matches`](hooks-matcher-never-matches.md) reports.

The rule does not read the command of the hook. It cannot tell a hook for a Unix shell only from other hooks.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, no plugin agent, and no `hooks.json` that Claude Code does not read.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "Bash", "hooks": [{ "type": "command", "command": "./check.sh" }] }]
  }
}
```

Pass:

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash|PowerShell", "hooks": [{ "type": "command", "command": "./check.sh" }] }
    ]
  }
}
```

## Sources

[^hooks]: [Hooks reference: PowerShell](https://code.claude.com/docs/en/hooks#powershell)
[^tools]: [Tools reference: PowerShell tool](https://code.claude.com/docs/en/tools-reference#powershell-tool)
[^patterns]: [Hooks reference: Matcher patterns](https://code.claude.com/docs/en/hooks#matcher-patterns)
