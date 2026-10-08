---
type: Reference
description: The ESLint rule claude/settings-marketplace-key-alias-conflict, which reports additionalMarketplaces or allowedMarketplaces in a project settings file that also sets extraKnownMarketplaces or strictKnownMarketplaces, because Claude Code ignores the alias.
owner: brianespinosa
created: 2026-10-08
related_issues: [12]
stale_after: 2027-04-08
generated:
  by: claude-code
  at: 2026-10-08T00:00:00Z
---

# `settings-marketplace-key-alias-conflict`

Do not set a marketplace key and its alias in one settings file.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

## Rule details

Claude Code reads `additionalMarketplaces` as `extraKnownMarketplaces`, and `allowedMarketplaces`
as `strictKnownMarketplaces`. When one file sets both spellings, Claude Code uses the value of the
canonical key and ignores the alias.[^aliases][^org] So the alias value has no effect.

The rule reports the alias key when the same file sets its canonical key. There are two pairs:

| Alias | Canonical key |
|-------|---------------|
| `additionalMarketplaces` | `extraKnownMarketplaces` |
| `allowedMarketplaces` | `strictKnownMarketplaces` |

A file that sets both pairs gets two reports. The report is on the alias key, whichever key comes
first.

The rule counts a key as set for any value, also `null` and the empty string. The docs name no value
that Claude Code reads differently. When a file has two members with one key, the rule reads the
last, as `JSON.parse` does. It reports the last alias member only.

The rule reads one file. Claude Code merges the settings files of all scopes. A conflict between two files is not a conflict
in one file. The rule does not check that case. A file that
sets an alias without the canonical key gets no report here. `settings-marketplace-key-alias`
covers the choice of the canonical spelling.

Fail:

```json
{
  "extraKnownMarketplaces": {
    "acme-tools": { "source": { "source": "github", "repo": "acme-corp/claude-plugins" } }
  },
  "additionalMarketplaces": {
    "other-tools": { "source": { "source": "github", "repo": "acme-corp/other-plugins" } }
  }
}
```

Pass:

```json
{
  "extraKnownMarketplaces": {
    "acme-tools": { "source": { "source": "github", "repo": "acme-corp/claude-plugins" } },
    "other-tools": { "source": { "source": "github", "repo": "acme-corp/other-plugins" } }
  }
}
```

## Sources

[^aliases]: [All settings: Marketplace key aliases](https://code.claude.com/docs/en/settings-reference#marketplace-key-aliases)
[^org]: [Manage Claude Code plugins for your organization: Aliases for the marketplace keys](https://code.claude.com/docs/en/plugins/org#aliases-for-the-marketplace-keys)
