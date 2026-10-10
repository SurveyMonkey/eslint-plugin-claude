---
type: Reference
description: The ESLint rule claude/hooks-matcher-subagent-anchor, which reports a SubagentStart or SubagentStop matcher that holds the colon of a plugin-scoped agent name and lacks the ^ and $ anchors.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-matcher-subagent-anchor`

Anchor a subagent matcher that holds the colon of a plugin-scoped name.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

A subagent from a plugin has a scoped name, such as `my-plugin:reviewer`. The colon is not an exact-match
character, so Claude Code reads the matcher as a regular expression. A regular expression matches anywhere in
the agent type. The docs say to anchor it with `^` and `$`, as in `^my-plugin:reviewer$`.[^start][^subagents]

The rule reads the `matcher` of a group under `SubagentStart` and `SubagentStop`. It reports a matcher that
holds a colon and does not start with `^` and end with `$`. A list with a `|` outside a group is not anchored,
because `^a:b|c:d$` anchors one end of each side. A list is anchored when each alternative has both anchors,
as in `^a:b$|^c:d$`. The message gives the anchored form. For a list, it puts the
alternatives in a group: `^(a:b|c:d)$`.

The rule makes no report for a matcher with no colon, or on another event. [`hooks-matcher-syntax`](hooks-matcher-syntax.md)
reports a matcher that is not a valid regular expression. This rule makes no report for such a matcher. It also
skips a colon that opens a group, as in `(?:Explore|Plan)`.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, no plugin agent, and no `hooks.json` that Claude Code does not read.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "SubagentStart": [
      { "matcher": "my-plugin:reviewer", "hooks": [{ "type": "command", "command": "./setup.sh" }] }
    ]
  }
}
```

Pass:

```json
{
  "hooks": {
    "SubagentStart": [
      { "matcher": "^my-plugin:reviewer$", "hooks": [{ "type": "command", "command": "./setup.sh" }] }
    ]
  }
}
```

## Sources

[^start]: [Hooks reference: SubagentStart](https://code.claude.com/docs/en/hooks#subagentstart)
[^subagents]: [Subagents: Project-level hooks for subagent events](https://code.claude.com/docs/en/sub-agents#project-level-hooks-for-subagent-events)
