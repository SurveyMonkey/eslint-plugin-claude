---
type: Reference
description: The ESLint rule claude/settings-conflicting-keys, which reports a settings key that another key in the same file voids, such as verbose with viewMode, spinnerTipsOverride with spinnerTipsEnabled false, or timeZone with timeFormat 24-hour-utc.
owner: brianespinosa
created: 2026-10-09
related_issues: [14]
stale_after: 2027-04-09
generated:
  by: claude-code
  at: 2026-10-09T00:00:00Z
---

# `settings-conflicting-keys`

Do not set a settings key that another key in the same file voids.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | consistency | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

Some pairs of settings keys cancel each other. Claude Code ignores one key of the pair. The
rule reports the key that Claude Code ignores. The report is on that key.

The rule reads the linted file. In a managed file, two pairs also need the sibling files of the
same managed source, and the rule reads them (see below). A key in any other file is not seen.
A `null` value removes a
key, so the rule takes it as no key. For two keys of one name, the rule reads the last, as
`JSON.parse` does. A hidden file in `managed-settings.d/` gets no report, because Claude Code
ignores it.

### The pairs

| Reported key | The same file also holds | Files | The docs say |
|--------------|--------------------------|-------|--------------|
| `verbose` | `viewMode` set to `default`, `verbose` or `focus` | every file | "When set, it overrides both the sticky `/focus` selection and the `verbose` setting."[^viewmode] |
| `spinnerTipsOverride` | `spinnerTipsEnabled: false` | every file | "If you set `spinnerTipsEnabled` to `false`, Claude Code hides all tips, yours included."[^tips] |
| `enableWorkflows: true` | `disableWorkflows: true` | every file | "`enableWorkflows: true` can't turn workflows back on while any source turns workflows off."[^workflows] |
| `statusLine`, `subagentStatusLine`, `fileSuggestion` | `disableAllHooks: true` | every file | In managed settings, the key turns the command "off entirely". In another file, Claude Code narrows the command to managed settings, and "skips your value without warning".[^gates] |
| `viewMode: "focus"` | `tui: "default"` | every file | "Focus view needs the fullscreen renderer."[^viewmode] The `tui` value `"default"` is the classic renderer.[^tui] |
| `vimInsertModeRemaps` | `editorMode` set to a value other than `"vim"` | managed files | "Has no effect unless `editorMode` is `"vim"`."[^vim] |
| `permissions.defaultMode: "auto"` | `disableAutoMode: "disable"`, at the top level or in `permissions` | every file | A session that would start in auto mode, "whether from `--permission-mode auto`, a settings file, or the built-in default, starts in `default` instead."[^auto] |
| `timeZone` | `timeFormat: "24-hour-utc"` | every file | "If `timeFormat` is `"24-hour-utc"`, times stay in UTC and Claude Code ignores this key."[^zone] |
| `allowedChannelPlugins` | `channelsEnabled` that is not `true` | managed files | "This setting requires `channelsEnabled: true`."[^channels] |

### Pairs that the rule narrows

The rule checks less than the planned check for three pairs. For each, the other key can be in a
file that the rule does not read. The rule makes no report that the docs do not support.

- **`viewMode: "focus"` without `tui`.** The `tui` key has no default value. Claude Code
  "picks the renderer for you" when the key is unset, so an unset `tui` is no fault.[^tui] The
  rule reports `tui: "default"` only. The rule does not check `tui` for any other value.
- **`vimInsertModeRemaps` without `editorMode`.** `editorMode` is a key of every file, and the
  default is `"normal"`.[^editor] A user file can set `"vim"`. So the rule reports a managed file
  that sets `editorMode` to another value. It makes no report when the key is unset, or when a
  sibling file of the managed source sets `editorMode` to `"vim"`. In a project
  or local file, Claude Code does not read `vimInsertModeRemaps` at all. `settings-key-scope`
  reports it there, so this rule makes no second report.
- **`allowedChannelPlugins` without `channelsEnabled`.** A managed file holds both keys. The
  rule reports the list in a managed file when the managed source does not set
  `channelsEnabled: true`. The rule reads the sibling files, because the page merges
  `managed-settings.json` and its drop-ins into one source. It makes no report when a sibling sets
  the key to `true`, or when the file sets `channelsEnabled` to a value of another type. In a project or local file, `settings-key-scope` reports `allowedChannelPlugins`, so
  this rule makes no second report.

### What the rule does not check

- A key in a file outside the managed source. A sibling that the rule cannot read gives no report
  for the two pairs above.
- A later file that turns a key off. A later drop-in can replace a single value of this file. The
  rule does not check the order of the files.
- A value of a wrong type. `settings-schema` is for that. A pair applies only when each key has the
  type that the table names.
- Whether `disableAllHooks` in a project file wins over a value in `settings.local.json`. The
  rule reads one file.

Fail, in `.claude/settings.json`:

```json
{
  "verbose": true,
  "viewMode": "default",
  "spinnerTipsEnabled": false,
  "spinnerTipsOverride": { "tips": ["Run /doctor"] },
  "timeFormat": "24-hour-utc",
  "timeZone": "Europe/Dublin"
}
```

Pass:

```json
{
  "viewMode": "default",
  "spinnerTipsOverride": { "tips": ["Run /doctor"] },
  "timeFormat": "24-hour",
  "timeZone": "Europe/Dublin"
}
```

## Sources

[^viewmode]: [All settings: viewMode](https://code.claude.com/docs/en/settings-reference#viewmode)
[^tips]: [All settings: spinnerTipsOverride](https://code.claude.com/docs/en/settings-reference#spinnertipsoverride)
[^workflows]: [All settings: enableWorkflows](https://code.claude.com/docs/en/settings-reference#enableworkflows)
[^gates]: [All settings: Status line and file suggestion gates](https://code.claude.com/docs/en/settings-reference#status-line-and-file-suggestion-gates)
[^tui]: [All settings: tui](https://code.claude.com/docs/en/settings-reference#tui)
[^vim]: [All settings: vimInsertModeRemaps](https://code.claude.com/docs/en/settings-reference#viminsertmoderemaps)
[^editor]: [All settings: editorMode](https://code.claude.com/docs/en/settings-reference#editormode)
[^auto]: [All settings: disableAutoMode](https://code.claude.com/docs/en/settings-reference#disableautomode)
[^zone]: [All settings: timeZone](https://code.claude.com/docs/en/settings-reference#timezone)
[^channels]: [Push events into a running session with channels: Restrict which channel plugins can run](https://code.claude.com/docs/en/channels#restrict-which-channel-plugins-can-run)
