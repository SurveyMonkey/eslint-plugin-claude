---
type: Reference
description: The ESLint rule claude/hooks-no-standalone-file, which reports a hooks.json file in .claude/ or .claude-plugin/ that Claude Code does not read, because project hooks go under the hooks key of a settings file and a plugin keeps hooks/hooks.json at its root.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-no-standalone-file`

Put project hooks under the `hooks` key of a settings file, not in a hooks file.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/hooks.json`, `**/.claude/hooks/hooks.json`, `**/.claude-plugin/hooks.json`, `**/.claude-plugin/hooks/hooks.json` |

## Rule details

Claude Code has no standalone hooks file for project or user hooks. Hooks go under the `hooks` key of a
settings file.[^causes][^check] Only a plugin loads a separate `hooks/hooks.json`, and it loads it from the plugin
root.[^components][^locations] The manifest goes in `.claude-plugin/`. Every other plugin file goes at the plugin root, and
that includes `hooks/`.[^layout] The rule reports at line 1 of the file. The hooks in such a file never run.

The rule reports these files:

- `.claude/hooks.json` and `.claude/hooks/hooks.json`. The message says to use the `hooks` key of a settings
  file.
- `.claude-plugin/hooks.json` and `.claude-plugin/hooks/hooks.json`. The message says that a plugin keeps
  `hooks/hooks.json` at the plugin root.

The rule makes no report in these cases:

- `.claude/` is itself a plugin root. Its `.claude/.claude-plugin/plugin.json` makes `.claude/hooks/hooks.json`
  the hooks file of that plugin.
- The `hooks` field of the manifest names the file under `.claude-plugin/`, as a path or as an item of an
  array.[^manifest] Claude Code then reads it.
- The rule cannot read the plugin root or the manifest (ADR 001, Decision 14).

Fail, at `.claude/hooks.json`:

```json
{ "hooks": { "PostToolUse": [] } }
```

Pass, in `.claude/settings.json`:

```json
{ "hooks": { "PostToolUse": [] } }
```

## Sources

[^causes]: [Debug your configuration: Check common causes](https://code.claude.com/docs/en/debug-your-config#check-common-causes)
[^check]: [Debug your configuration: Check hooks](https://code.claude.com/docs/en/debug-your-config#check-hooks)
[^components]: [Add components to a plugin: Hooks](https://code.claude.com/docs/en/plugins/components#hooks)
[^locations]: [Hooks reference: Hook locations](https://code.claude.com/docs/en/hooks#hook-locations)
[^layout]: [Plugin manifest reference: Manifest file](https://code.claude.com/docs/en/plugins/manifest-reference#manifest-file)
[^manifest]: [Plugin manifest reference: hooks](https://code.claude.com/docs/en/plugins/manifest-reference#hooks)
