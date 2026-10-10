---
type: Reference
description: The ESLint rule claude/settings-enabled-plugins-external-source, which reports a plugin set to true in .claude/settings.json whose entry in a repository marketplace has an external source, because Claude Code does not install it from the project settings alone.
owner: brianespinosa
created: 2026-10-10
related_issues: [12]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-enabled-plugins-external-source`

Do not rely on `.claude/settings.json` to install a plugin that has an external source.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | limit | `**/.claude/settings.json` |

## Rule details

A plugin that the marketplace lists by a relative path loads from the marketplace copy. A plugin
whose marketplace entry points at an external source, such as its own GitHub repository, does not
install from the repository settings alone.[^org] Each teammate sees
`Plugin "<name>" is enabled in project settings but isn't installed` until they run
`claude plugin install <name>@<marketplace> --scope project`.[^loading] This holds when the only
`true` for the plugin is in `.claude/settings.json`.

The rule reports a key of `enabledPlugins` in `.claude/settings.json` in this case:

1. The value is `true`.
2. The project settings declare the marketplace in `extraKnownMarketplaces`, with a `file` or
   `directory` source and a relative path.
3. The `marketplace.json` at that path has an entry for the plugin, and the `source` of the entry
   is an object.

The rule finds the marketplace in the project file of higher precedence that declares it. The file
`settings.local.json` is above `settings.json`. The rule reads the `marketplace.json` in the
repository, and makes no report when it cannot read the file. A string `source` is a relative path.
The `marketplace-relative-source-*` rules report a fault in one. A plugin with no entry in the
marketplace is for `settings-enabled-plugins-entry-exists`.

When two entries share a plugin name, the rule reports only if each of them is external. The
docs name one other way to install the plugin: a seed directory that already holds it.[^loading]
The rule cannot see a seed directory, so a team that seeds its machines can leave the rule off.

Fail:

```json
{
  "extraKnownMarketplaces": {
    "acme-tools": { "source": { "source": "directory", "path": "./marketplace" } }
  },
  "enabledPlugins": {
    "code-formatter@acme-tools": true
  }
}
```

The `marketplace/.claude-plugin/marketplace.json` lists the plugin with
`{ "name": "code-formatter", "source": { "source": "github", "repo": "acme-corp/code-formatter" } }`.

Pass: list the plugin with `"source": "./plugins/code-formatter"`.

## Sources

[^org]: [Manage Claude Code plugins for your organization: Require plugins per repository](https://code.claude.com/docs/en/plugins/org#require-plugins-per-repository)
[^loading]: [Plugin loading reference: Enabled in project settings but not installed](https://code.claude.com/docs/en/plugins/loading#enabled-in-project-settings-but-not-installed)
