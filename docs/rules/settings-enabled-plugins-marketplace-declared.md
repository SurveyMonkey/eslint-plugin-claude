---
type: Reference
description: The ESLint rule claude/settings-enabled-plugins-marketplace-declared, which reports an enabledPlugins key set to true whose marketplace no committed project settings file declares in extraKnownMarketplaces.
owner: brianespinosa
created: 2026-10-10
related_issues: [12]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-enabled-plugins-marketplace-declared`

Declare the marketplace of each enabled plugin in the committed settings.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | consistency | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

## Rule details

An `enabledPlugins` key is `plugin-name@marketplace-name`. The docs say to add the marketplace under
`extraKnownMarketplaces` and then to add each plugin under `enabledPlugins`.[^enabled][^org] A
teammate who has not added the marketplace gets no plugin from the key.

The rule is a heuristic, and it is `off` in `recommended`. A user can add a marketplace in a file
that the repository does not hold. The rule cannot see that file. `strict` turns the rule on at
`warn`.

The rule reports a key set to `true` when no committed file declares the marketplace part. It reads
both project files of the `.claude/` directory. A name in either file counts. It reads
`additionalMarketplaces` when the file does not set `extraKnownMarketplaces`.[^aliases]

The rule makes no report in these cases:

- The marketplace is `claude-plugins-official`. A `name@claude-plugins-official` key declares that
  marketplace by itself.[^org]
- The marketplace part is the origin of a plugin that has no marketplace: `inline`, `skills-dir`
  or `synced`.[^origin] Claude Code reserves these names, so no marketplace can have one. The rule
  also leaves `builtin` and `claude-plugin-test`, which Claude Code reserves in the same way.
- The value is `false`. The docs use `false` to block a plugin at every scope, and a block needs no
  marketplace.[^org]
- The key does not have the form `plugin@marketplace`. `settings-enabled-plugins-schema` reports it.
- The rule cannot read the other project file, because it is a dangling link, is out of the
  repository, or does not parse to an object.

Fail:

```json
{
  "enabledPlugins": {
    "code-formatter@acme-tools": true
  }
}
```

Pass:

```json
{
  "extraKnownMarketplaces": {
    "acme-tools": { "source": { "source": "github", "repo": "acme-corp/claude-plugins" } }
  },
  "enabledPlugins": {
    "code-formatter@acme-tools": true
  }
}
```

## Sources

[^enabled]: [All settings: enabledPlugins](https://code.claude.com/docs/en/settings-reference#enabledplugins)
[^org]: [Manage Claude Code plugins for your organization: Require a marketplace and its plugins](https://code.claude.com/docs/en/plugins/org#require-a-marketplace-and-its-plugins)
[^origin]: [Plugin loading reference: Find where a plugin came from](https://code.claude.com/docs/en/plugins/loading#find-where-a-plugin-came-from)
[^aliases]: [All settings: Marketplace key aliases](https://code.claude.com/docs/en/settings-reference#marketplace-key-aliases)
