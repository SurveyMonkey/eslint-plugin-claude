---
type: Reference
description: The ESLint rule claude/settings-marketplace-key-alias, which reports additionalMarketplaces or allowedMarketplaces in a project or managed settings file, because Claude Code before v2.1.232 ignores the aliases.
owner: brianespinosa
created: 2026-10-10
related_issues: [12]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-marketplace-key-alias`

Write `extraKnownMarketplaces` and `strictKnownMarketplaces`, not their aliases.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

Claude Code v2.1.232 and later read `additionalMarketplaces` as `extraKnownMarketplaces`, and
`allowedMarketplaces` as `strictKnownMarketplaces`. Earlier versions ignore the alias. The docs say
to keep the canonical name in a file that older versions also read. A managed settings file for a
fleet with mixed Claude Code versions is an example.[^aliases][^org]

The rule reports an alias key. Two other rules own two cases, so one fault gets one report:

- A file that sets an alias and its canonical key is for `settings-marketplace-key-alias-conflict`.
  The alias is ignored there.
- `allowedMarketplaces` in a project file is for `settings-key-scope`. The key
  `strictKnownMarketplaces` has the scope "Managed", so a project file does not accept it.[^scope]
  The rule reads `allowedMarketplaces` in the managed files only.

The rule does not read a hidden file in `managed-settings.d`. A key counts as set for any value.
When a file has two members with one alias name, the rule reports the last, as `JSON.parse` does.

Fail:

```json
{
  "additionalMarketplaces": {
    "acme-tools": { "source": { "source": "github", "repo": "acme-corp/claude-plugins" } }
  }
}
```

Pass:

```json
{
  "extraKnownMarketplaces": {
    "acme-tools": { "source": { "source": "github", "repo": "acme-corp/claude-plugins" } }
  }
}
```

## Sources

[^aliases]: [All settings: Marketplace key aliases](https://code.claude.com/docs/en/settings-reference#marketplace-key-aliases)
[^org]: [Manage Claude Code plugins for your organization: Aliases for the marketplace keys](https://code.claude.com/docs/en/plugins/org#aliases-for-the-marketplace-keys)
[^scope]: [All settings: strictKnownMarketplaces](https://code.claude.com/docs/en/settings-reference#strictknownmarketplaces)
