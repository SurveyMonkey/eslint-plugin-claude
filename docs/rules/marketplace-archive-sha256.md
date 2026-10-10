---
type: Reference
description: The ESLint rule claude/marketplace-archive-sha256, which reports an archive plugin source in a marketplace.json entry that sets no sha256, so Claude Code cannot refuse a changed download.
owner: brianespinosa
created: 2026-10-10
related_issues: [12]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `marketplace-archive-sha256`

Pin an `archive` plugin source with `sha256`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | security | `**/.claude-plugin/marketplace.json` |

## Rule details

An `archive` source is a zip that Claude Code downloads over HTTPS. The `sha256` is the digest of
the archive, as 64 hex characters. When the source sets it, Claude Code refuses a download that
does not match.[^sha] The host guide says to pin each archive with `sha256`, so that Claude Code
refuses a changed download.[^host] An archive with no pin installs whatever the URL serves.

The rule reports an object `source` with `"source": "archive"` and no `sha256` member. The report
is on the source object. A `sha256` with a bad value is not this rule's concern. The rule reports
the missing key only. `marketplace-source-schema` reports a `sha256` that is not 64 hex characters.

`claude plugin validate` warns about a missing pin for one case only: an entry that fetches its
archive with a `headersHelper`.[^validation] The rule reports an archive source in every case.

When an entry has two `source` keys, the rule reads the last, as `JSON.parse` does. A `source`
that is not an object with a string `source` is a fault for `marketplace-schema` and
`marketplace-source-schema`. The `archive` source type is in `src/data/marketplace-source-types.ts`.

Fail:

```json
{
  "name": "acme",
  "plugins": [
    {
      "name": "formatter",
      "source": { "source": "archive", "url": "https://artifacts.example.com/formatter-2.0.0.zip" }
    }
  ]
}
```

Pass:

```json
{
  "name": "acme",
  "plugins": [
    {
      "name": "formatter",
      "source": {
        "source": "archive",
        "url": "https://artifacts.example.com/formatter-2.0.0.zip",
        "sha256": "6bfa50e3d2e00c052b46abe51fff89346ac803e45771f76dcf6df1ab74cca5e1"
      }
    }
  ]
}
```

## Options

None.

## Sources

[^sha]: [Marketplace reference: archive plugin source](https://code.claude.com/docs/en/plugins/marketplace-reference#archive-plugin-source)
[^host]: [Host and maintain a marketplace: Serve users who have no git-host account](https://code.claude.com/docs/en/plugins/host-marketplace#serve-users-who-have-no-git-host-account)
[^validation]: [Marketplace reference: Validation messages](https://code.claude.com/docs/en/plugins/marketplace-reference#validation-messages)
