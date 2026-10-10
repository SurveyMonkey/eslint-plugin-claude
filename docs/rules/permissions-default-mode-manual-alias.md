---
type: Reference
description: The ESLint rule claude/permissions-default-mode-manual-alias, which reports permissions.defaultMode set to the manual alias in a project file when the option minVersion is below the first Claude Code version that accepts it, because an older client rejects the value.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-default-mode-manual-alias`

Write `default` in place of the `manual` alias of `permissions.defaultMode`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

The rule reads no managed file. Claude Code reads an invalid managed `permissions.defaultMode` as `default`, which is what
`manual` means, so an older client breaks nothing there.[^closed]

## Rule details

`manual` is an alias for `default`, the mode that the CLI calls Manual.[^alias][^mode] Claude Code v2.1.200 added the alias (see
the [Claude Code `CHANGELOG.md`](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)). A client that is older than that rejects the value. `default`
works on every version.

No file shows which client version reads it. So the rule reports only when you set the option `minVersion`, and
reports nothing when you leave it unset. With `minVersion` below `2.1.200`, the rule reports the value `"manual"` and
offers a suggestion that writes `"default"`.

Other rules check other things about the same key:

- `permissions-default-mode-value` reports a value that is not one of the seven modes.
- `permissions-default-mode-surface` reports a mode that a Claude Code surface ignores.

Fail, with `minVersion: "2.1.150"`:

```json
{
  "permissions": {
    "defaultMode": "manual"
  }
}
```

Pass:

```json
{
  "permissions": {
    "defaultMode": "default"
  }
}
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `minVersion` | unset | The lowest Claude Code version that reads your files, as `major.minor.patch`. The rule reports when it is below `2.1.200`. |

```js
"claude/permissions-default-mode-manual-alias": ["warn", { minVersion: "2.1.150" }]
```

The `recommended` and `strict` configs set no option, so they make no report from this rule.

## Sources

[^mode]: [All settings: permissions.defaultMode](https://code.claude.com/docs/en/settings-reference#permissionsdefaultmode)
[^alias]: [Choose a permission mode: Available modes](https://code.claude.com/docs/en/permission-modes#available-modes)
[^closed]: [Deploy managed settings: Keys that fail closed](https://code.claude.com/docs/en/managed-settings#keys-that-fail-closed)
