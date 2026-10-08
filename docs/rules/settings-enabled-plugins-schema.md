---
type: Reference
description: The ESLint rule claude/settings-enabled-plugins-schema, which reports an enabledPlugins key in a project settings file that is not plugin-name@marketplace-name with one @ and a name on each side, and a value that is not a Boolean.
owner: brianespinosa
created: 2026-10-08
related_issues: [12]
stale_after: 2027-04-08
generated:
  by: claude-code
  at: 2026-10-08T00:00:00Z
---

# `settings-enabled-plugins-schema`

Write each `enabledPlugins` key as `plugin-name@marketplace-name`, with a Boolean value.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

## Rule details

The `enabledPlugins` key is an object. Each key is `plugin-name@marketplace-name`, and each value is
`true` or `false`.[^key][^org] The rule reports two faults for each member:

- **Key form.** The key does not have exactly one `@` with text on each side. These keys fail:
  `formatter`, `a@b@c`, `@market`, `plugin@` and the empty string.
- **Value type.** The value is not `true` or `false`. A string such as `"true"`, a number, `null`,
  an array and an object each give a report.

A bad key and a bad value in one member are two faults, so they give two reports. The key report is
on the key. The value report is on the value.

The docs use `synced` as a marketplace name for plugins that come from no marketplace, for example
`"<name>@synced": false`.[^synced] It has the same form, so the rule accepts it. The rule does not
check that the marketplace or the plugin exists.

When `enabledPlugins` has two members with one key, the rule reads the last, as `JSON.parse`
does. When a file has two `enabledPlugins` keys, the rule reads the last one.

The rule does not check these cases:

- An `enabledPlugins` that is not an object. The docs give the type, but this rule reads the
  members only.
- The characters of a name. The docs give a name form for a plugin `name` field, and none for a key.
- A plugin or marketplace that is not there. `settings-enabled-plugins-entry-exists` reads the
  `marketplace.json` of a marketplace that the repository holds.

Fail:

```json
{
  "enabledPlugins": {
    "formatter": true,
    "linter@team-tools": "yes"
  }
}
```

Pass:

```json
{
  "enabledPlugins": {
    "formatter@team-tools": true,
    "linter@team-tools": false
  }
}
```

## Sources

[^key]: [All settings: enabledPlugins](https://code.claude.com/docs/en/settings-reference#enabledplugins)
[^org]: [Manage Claude Code plugins for your organization: Require a marketplace and its plugins](https://code.claude.com/docs/en/plugins/org#require-a-marketplace-and-its-plugins)
[^synced]: [All settings: syncClaudeAiPlugins](https://code.claude.com/docs/en/settings-reference#syncclaudeaiplugins)
