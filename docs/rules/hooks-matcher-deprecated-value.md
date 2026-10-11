---
type: Reference
description: The ESLint rule claude/hooks-matcher-deprecated-value, which reports the matcher value bypass_permissions_disabled on SessionEnd, because Claude Code removed it in v2.1.234 and does not send it.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-matcher-deprecated-value`

Drop the matcher value that Claude Code no longer sends.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | deprecated | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

`bypass_permissions_disabled` was a `SessionEnd` reason. The docs say that Claude Code removed it in v2.1.234
and does not send it. They tell you to drop it from `SessionEnd` matchers.[^sessionend] A hook with only this
value never runs.

The rule reports at the `matcher` value, once for each such segment. It reads a matcher that holds exact-match
characters only: letters, digits, `_`, `-`, spaces, `,` and `|`.[^patterns] It makes no report for a regular
expression, because the rule cannot read which values it selects.

[`hooks-matcher-enum`](hooks-matcher-enum.md) makes no report for this value, so the two rules do not
report the same segment.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, no plugin agent, and no `hooks.json` that Claude Code does not read.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionEnd": [
      { "matcher": "logout|bypass_permissions_disabled", "hooks": [{ "type": "command", "command": "./bye.sh" }] }
    ]
  }
}
```

Pass:

```json
{
  "hooks": {
    "SessionEnd": [{ "matcher": "logout", "hooks": [{ "type": "command", "command": "./bye.sh" }] }]
  }
}
```

## Sources

[^sessionend]: [Hooks reference: SessionEnd](https://code.claude.com/docs/en/hooks#sessionend)
[^patterns]: [Hooks reference: Matcher patterns](https://code.claude.com/docs/en/hooks#matcher-patterns)
