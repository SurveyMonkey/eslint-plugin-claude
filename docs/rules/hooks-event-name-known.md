---
type: Reference
description: The ESLint rule claude/hooks-event-name-known, which reports a hook event name that Claude Code does not know in hooks.json, settings, plugin.json or the frontmatter of a skill or subagent, and suggests the correct name for a near miss.
owner: brianespinosa
created: 2026-09-29
related_issues: [6]
stale_after: 2027-03-29
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-event-name-known`

Use a hook event name that Claude Code knows.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/.claude-plugin/plugin.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

Claude Code skips a hook entry under an event name that it does not know. It shows no
error.[^lifecycle][^never] The names are case-sensitive.

The rule reads the `hooks` key at the top level of each file. When a file has two `hooks` keys,
the rule reads the last one, as `JSON.parse` does. In `plugin.json`, `hooks` can be an object, a
path, or an array of paths and objects.[^manifest] The rule reads each object, and ignores each
path. It checks each key against the 33 events in the hooks reference, as of Claude Code
2.1.285. The list is in `src/data/hook-events.ts`.

The rule also reads the `hooks` field in the frontmatter of a skill (`SKILL.md`) and of a project
subagent.[^frontmatter] These use the same event names. It reads the managed settings files too: `managed-settings.json` and each
`managed-settings.d/*.json` drop-in. It reads no hidden drop-in, and no plugin subagent, because
Claude Code ignores the `hooks` field of a plugin subagent.

The rule reads a `hooks/hooks.json` only when Claude Code reads it. It makes no report on
`.claude/hooks/hooks.json` or `.claude-plugin/hooks/hooks.json`, unless `.claude/` is a plugin root or
the plugin manifest names the file. It makes no report on a file in a hidden folder such
as `.github/hooks/hooks.json`. [`hooks-no-standalone-file`](hooks-no-standalone-file.md) reports the first
two, so a file gets one report.

A key that is a near miss gets a suggestion with the correct name. A near miss has the same
letters with a different case or separator (`preToolUse`, `pre_tool_use`). It can also be two
edits or fewer from a known name. The edit count ignores case and separators. The suggestion is
not an autofix. A rename changes what runs, because a hook that never ran starts to run.

Fail:

```json
{ "hooks": { "preToolUse": [] } }
```

Pass:

```json
{ "hooks": { "PreToolUse": [] } }
```

Fail, in the frontmatter of a skill:

```yaml
---
name: example
hooks:
  preToolUse:
    - hooks:
        - type: command
          command: ./check.sh
---
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
[^frontmatter]: [Hooks reference: Hooks in skills and agents](https://code.claude.com/docs/en/hooks#hooks-in-skills-and-agents)
