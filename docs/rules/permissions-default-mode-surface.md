---
type: Reference
description: The ESLint rule claude/permissions-default-mode-surface, which reports permissions.defaultMode set to dontAsk, because cloud sessions ignore it, and with the option vscode any project or local defaultMode, because the VS Code extension never reads it.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# claude/permissions-default-mode-surface

📝 Do not rely on permissions.defaultMode where a Claude Code surface ignores it.

⚠️ This rule _warns_ in the following configs: ✅ `recommended`, 🔒 `strict`.

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| portability | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule reads no hidden drop-in in `managed-settings.d`, because Claude Code ignores it.

## Rule details

Cloud sessions honor only `acceptEdits`, `plan`, `default` and `auto` from this key.[^mode] They ignore `dontAsk` from a settings
file, with no message, and the session starts in the mode of its dropdown.[^dontask][^bypass] The rule reports `defaultMode: "dontAsk"` in
every file that it lints.

The VS Code extension reads the mode of a new conversation from user and managed values.[^vscode] The settings reference adds
`--settings` values.[^mode] It never reads a project or local file. With the option `vscode` set to `true`, the rule also reports any `defaultMode` in a project or local file. The
rule reads no managed file for this option, because the extension reads those values.

### One report for one fault

These modes have a rule of their own, so this rule makes no report for them:

- `bypassPermissions`: [`permissions-bypass-mode-committed`](permissions-bypass-mode-committed.md). Cloud sessions ignore the value
  too.[^bypass]
- `auto` in a project or local file: [`permissions-default-mode-project-ignored`](permissions-default-mode-project-ignored.md).

`manual` is an alias for `default`. The rule makes no cloud report for it. With `vscode` on, a `dontAsk` value in a project
file gets both reports, because the two faults differ. A value that is no mode also gets the `vscode` report, and
`permissions-default-mode-value` reports the value itself.

Fail:

```json
{
  "permissions": {
    "defaultMode": "dontAsk"
  }
}
```

Pass:

```json
{
  "permissions": {
    "defaultMode": "plan"
  }
}
```

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/permissions-default-mode-surface': 'warn'
```

## Options

<!-- begin auto-generated rule options list -->

| Name     | Description                                                       | Type    | Default |
| :------- | :---------------------------------------------------------------- | :------ | :------ |
| `vscode` | Set true to also report a defaultMode in a project or local file. | Boolean | `false` |

<!-- end auto-generated rule options list -->

```js
"claude/permissions-default-mode-surface": ["warn", { vscode: true }]
```

## Sources

[^mode]: [All settings: permissions.defaultMode](https://code.claude.com/docs/en/settings-reference#permissionsdefaultmode)
[^dontask]: [Choose a permission mode: Allow only pre-approved tools with dontAsk mode](https://code.claude.com/docs/en/permission-modes#allow-only-pre-approved-tools-with-dontask-mode)
[^bypass]: [Choose a permission mode: Skip all checks with bypassPermissions mode](https://code.claude.com/docs/en/permission-modes#skip-all-checks-with-bypasspermissions-mode)
[^vscode]: [Choose a permission mode: Switch permission modes](https://code.claude.com/docs/en/permission-modes#switch-permission-modes)
