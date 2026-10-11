---
type: Reference
description: The ESLint rule claude/settings-extra-known-marketplaces-directory, which reports a directory marketplace source with an absolute path in a committed .claude/settings.json, because the path exists on one machine.
owner: brianespinosa
created: 2026-10-10
related_issues: [12]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-extra-known-marketplaces-directory`

Do not point a committed `extraKnownMarketplaces` entry at a directory by an absolute path.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude/settings.json` |

## Rule details

A `directory` source is a local filesystem path. The docs say to use it for development, or for a
marketplace that your organization deploys to each machine.[^types] An absolute path in a committed
file exists on one machine. A teammate gets a marketplace that is not there.

A relative path resolves against the repository. The docs describe a `directory` or `file` source
with a relative path for a repository.[^org] So the rule leaves a relative path.

The rule reports the `path` of a `directory` source in `.claude/settings.json` when the path is
absolute. A POSIX path, a path that starts with `/`, and a Windows drive path count. The result
does not depend on the machine that runs ESLint. The rule reads `additionalMarketplaces` when the
file does not set `extraKnownMarketplaces`. It reads one file. A managed file can deploy a
marketplace to each machine, so the rule does not read it.

The rule does not check a missing `path`, or a `path` that is not a string. The
`settings-extra-known-marketplaces-schema` rule reports them.

Fail:

```json
{
  "extraKnownMarketplaces": {
    "acme-tools": { "source": { "source": "directory", "path": "/Users/dev/acme-marketplace" } }
  }
}
```

Pass:

```json
{
  "extraKnownMarketplaces": {
    "acme-tools": { "source": { "source": "directory", "path": "./marketplace" } }
  }
}
```

## Sources

[^types]: [All settings: Marketplace source types](https://code.claude.com/docs/en/settings-reference#marketplace-source-types)
[^org]: [Manage Claude Code plugins for your organization: Require plugins per repository](https://code.claude.com/docs/en/plugins/org#require-plugins-per-repository)
