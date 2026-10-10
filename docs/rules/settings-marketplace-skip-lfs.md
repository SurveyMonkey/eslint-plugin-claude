---
type: Reference
description: The ESLint rule claude/settings-marketplace-skip-lfs, which reports a skipLfs field in the source of an extraKnownMarketplaces entry in a project or managed settings file, because Claude Code accepts the field and ignores it since v2.1.274.
owner: brianespinosa
created: 2026-10-10
related_issues: [12]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-marketplace-skip-lfs`

Remove `skipLfs` from a marketplace source.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | deprecated | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

Before v2.1.274, Claude Code downloaded Git LFS content unless the source set `"skipLfs": true`.
Now Claude Code never downloads LFS content when it clones a marketplace. It checks LFS files out
as pointer files. It accepts the `skipLfs` field and the field has no effect.[^types][^fields] The
field does nothing. A reader can think that it controls LFS.

The rule reports the `skipLfs` key in the `source` of an `extraKnownMarketplaces` entry, for a
`github` or `git` source. The docs list the field for those two types.[^fields] The rule reads
`additionalMarketplaces` when the file does not set `extraKnownMarketplaces`. It reads the project
settings files and the managed settings files. It skips a hidden file in `managed-settings.d`.

The rule does not read the entries of `strictKnownMarketplaces` and `blockedMarketplaces`. The docs
state the field for the source object of a marketplace.

Fail:

```json
{
  "extraKnownMarketplaces": {
    "acme-tools": {
      "source": { "source": "github", "repo": "acme-corp/claude-plugins", "skipLfs": true }
    }
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

[^types]: [All settings: Marketplace source types](https://code.claude.com/docs/en/settings-reference#marketplace-source-types)
[^fields]: [Marketplace reference: Fields by type](https://code.claude.com/docs/en/plugins/marketplace-reference#fields-by-type)
