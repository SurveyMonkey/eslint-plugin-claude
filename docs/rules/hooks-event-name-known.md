---
type: Reference
description: The ESLint rule claude/hooks-event-name-known, which reports a hook event name that Claude Code does not know in hooks.json, settings or plugin.json, and suggests the correct name for a near miss.
owner: brianespinosa
created: 2026-09-29
related_issues: [6]
stale_after: 2027-03-29
generated:
  by: claude-code
  at: 2026-09-29T00:00:00Z
---

# `hooks-event-name-known`

Use a hook event name that Claude Code knows.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/hooks/hooks.json`, `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/.claude-plugin/plugin.json` |

## Rule details

Claude Code skips a hook entry under an event name that it does not know. It shows no
error.[^lifecycle][^never] The names are case-sensitive.

The rule reads the `hooks` key at the top level of each file. When a file has two `hooks` keys,
the rule reads the last one, as `JSON.parse` does. In `plugin.json`, `hooks` can be
an object, a path, or an array of paths and objects.[^manifest] The rule reads each object, and
ignores each path. It checks each key against the 33 events in the hooks reference, as of Claude
Code 2.1.285. The list is in `src/data/hook-events.ts`.

A key that is a near miss gets a suggestion with the correct name. A near miss has the same
letters with a different case or separator (`preToolUse`, `pre_tool_use`), or is two edits or
fewer from a known name. The suggestion is not an autofix. A rename changes what runs, because
a hook that never ran starts to run.

Hooks in skill and agent frontmatter use the same names. A later rule checks them.

Fail:

```json
{ "hooks": { "preToolUse": [] } }
```

Pass:

```json
{ "hooks": { "PreToolUse": [] } }
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `additionalEvents` | `[]` | Event names to accept that are not in the list yet, for a Claude Code release newer than the list. |

```js
'claude/hooks-event-name-known': ['error', { additionalEvents: ['NewEvent'] }]
```

## Sources

[^lifecycle]: [Hooks reference: Hook lifecycle](https://code.claude.com/docs/en/hooks#hook-lifecycle)
[^never]: [Troubleshoot plugins: Hook loads but never fires](https://code.claude.com/docs/en/plugins/troubleshooting#hook-loads-but-never-fires)
[^manifest]: [Plugin manifest reference: hooks](https://code.claude.com/docs/en/plugins/manifest-reference#hooks)
