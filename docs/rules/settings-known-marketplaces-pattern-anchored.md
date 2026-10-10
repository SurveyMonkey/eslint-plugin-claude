---
type: Reference
description: The ESLint rule claude/settings-known-marketplaces-pattern-anchored, which reports a hostPattern or pathPattern entry of strictKnownMarketplaces that is not anchored, because Claude Code matches the pattern anywhere and the entry allows more than it appears to.
owner: brianespinosa
created: 2026-10-10
related_issues: [12]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-known-marketplaces-pattern-anchored`

Anchor the `hostPattern` and `pathPattern` entries of `strictKnownMarketplaces`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | security | `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

A `hostPattern` entry is a regular expression. Claude Code matches it against the host of a
`github`, `git` or `url` source. The pattern matches anywhere in the host, so the docs say to anchor
it with `^` and `$`. A `pathPattern` entry is a regular expression for the `path` of a `file` or
`directory` source. It matches anywhere in the path, so the docs say to start it with `^`.[^types][^org]
An unanchored pattern allows more sources than the author meant. For example, `github.example.com`
also allows `github.example.com.attacker.test`.

The rule reports these entries of the allowlist:

- A `hostPattern` that does not start with `^`, or does not end with `$`. A `$` after an odd
  number of backslashes is a literal character, and is no anchor.
- A `pathPattern` that does not start with `^`.

The docs show `".*"` as the `pathPattern` that allows every local path.[^org] The rule leaves that
exact value. It does not leave `".*"` as a `hostPattern`.

The rule reads `strictKnownMarketplaces`, and its alias `allowedMarketplaces` when the file does not
set the canonical key. It does not read `blockedMarketplaces`. An unanchored pattern in the blocklist
blocks more sources, and does not widen what users can add. It skips a hidden file in
`managed-settings.d`.

The rule is a text check. It does not parse the pattern. A pattern with an alternation is checked as text. The rule
reports `^a$|b`, because the text ends in `b`. It does not report `^a|b$`. A pattern that does not compile is for
`settings-known-marketplaces-policy-schema`, so the rule does not report it.

Fail:

```json
{
  "strictKnownMarketplaces": [
    { "source": "hostPattern", "hostPattern": "github\\.example\\.com" },
    { "source": "pathPattern", "pathPattern": "/opt/approved/" }
  ]
}
```

Pass:

```json
{
  "strictKnownMarketplaces": [
    { "source": "hostPattern", "hostPattern": "^github\\.example\\.com$" },
    { "source": "pathPattern", "pathPattern": "^/opt/approved/" }
  ]
}
```

## Sources

[^types]: [All settings: Allowed source types](https://code.claude.com/docs/en/settings-reference#allowed-source-types)
[^org]: [Manage Claude Code plugins for your organization: Allowlist with strictKnownMarketplaces](https://code.claude.com/docs/en/plugins/org#allowlist-with-strictknownmarketplaces)
