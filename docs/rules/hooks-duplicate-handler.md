---
type: Reference
description: The ESLint rule claude/hooks-duplicate-handler, which reports a hook handler in a plugin hooks.json or plugin.json that a settings file or another plugin source already defines, because Claude Code loads both.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-duplicate-handler`

Do not define one hook handler in a plugin and in the project settings, or twice in a plugin.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | consistency | `**/hooks/hooks.json`, `**/.claude-plugin/plugin.json` |

## Rule details

A plugin can define hooks in `hooks/hooks.json` and in the `hooks` key of `plugin.json`. Claude Code loads
both.[^manifest][^components] A hook in a project settings file and in a plugin `hooks.json` runs twice each
time its event fires.[^convert] The docs say this for the settings pair only. A handler that two settings
files define runs once.[^fields] So the rule never pairs two settings files.

The rule compares each handler of the linted file with the handlers of the earlier sources. Two handlers are
identical when the event, the `matcher` and every field of the handler are equal. The order of the keys does
not matter. An omitted `matcher`, `""` and `"*"` count as one matcher, because each matches every
occurrence of the event. The docs do not say what makes two handlers the same. A handler that differs in one field, such as
`timeout`, is no match.

One pair gets one report, on the later source. The order is:

1. The project settings files: `.claude/settings.json` and `.claude/settings.local.json`.
2. The `hooks/hooks.json` of the plugin.
3. The `hooks` key of `.claude-plugin/plugin.json`.

So a duplicate of a settings handler is reported in `hooks/hooks.json` or in `plugin.json`, never in the
settings file. A duplicate of a `hooks.json` handler is reported in `plugin.json`. The rule reports at the
handler and names the first earlier source that holds it.

For `plugin.json`, `hooks` is a path, an event map, or an array of both.[^manifest] The rule reads the event
maps. It does not read a hooks file that a path names.

The rule reads the settings files of the plugin folder. It reads those of each folder above it, up to the
repository root. If it finds no `.git`, it reads the plugin folder only. A project can keep a plugin in a sub
folder, as in the plugin guide.[^convert]

The rule reads no file outside the repository. A file that is not there, that does not parse, or that the
rule cannot read gives no report. The rule does not read a user settings file or a managed settings file.

`disableAllHooks` merges across the settings files. The nearest file that sets it wins, and
`settings.local.json` wins over `settings.json`. When the merged value is `true`, no settings handler counts.

The rule reads no `hooks.json` that Claude Code does not read, and no `plugin.json` outside `.claude-plugin/`.

Fail, in `hooks/hooks.json` with the same handler in `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [{ "matcher": "Write", "hooks": [{ "type": "command", "command": "./fmt.sh" }] }]
  }
}
```

Pass: keep the handler in one source.

## Sources

[^manifest]: [Plugin manifest reference: hooks](https://code.claude.com/docs/en/plugins/manifest-reference#hooks)
[^components]: [Add components to a plugin: Hooks](https://code.claude.com/docs/en/plugins/components#hooks)
[^convert]: [Create a Claude Code plugin: Convert an existing .claude/ setup](https://code.claude.com/docs/en/plugins/create#convert-an-existing-claude-setup)
[^fields]: [Hooks reference: Hook handler fields](https://code.claude.com/docs/en/hooks#hook-handler-fields)
