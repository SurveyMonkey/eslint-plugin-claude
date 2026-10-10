---
type: Reference
description: The ESLint rule claude/sandbox-domain-overlap, which reports a sandbox allowedDomains entry that a deniedDomains entry of the same settings source holds too, because Claude Code blocks a denied domain and the allowed entry never applies.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `sandbox-domain-overlap`

Do not allow a sandbox domain that `deniedDomains` also holds.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule skips a hidden drop-in in `managed-settings.d`, because Claude Code ignores it.

## Rule details

A denied domain stays blocked although an `allowedDomains` entry matches it too.[^denied] So an allowed entry that a denied
entry covers never applies. The rule reports the allowed entry.

An allowed entry is covered when a denied entry has the same host, and either has no port or has the same port. The rule
ignores the letter case of the host and one trailing dot, as in `example.com.`.[^denied] An entry with no port matches every
port, so `example.com` in `deniedDomains` covers `example.com:443` in `allowedDomains`. The reverse does not hold: a denied
`example.com:443` leaves the other ports of an allowed `example.com` open.[^allowed]

### Limits

The rule compares a wildcard as text. It reports an equal `*.example.com` in both lists. It gives no report for a denied
`*.example.com` with an allowed `api.example.com`, although Claude Code blocks that host.[^denied]
The rule does not read the domains of `WebFetch` rules or a user file.

### One source

The rule adds up the lists of one source. For a project file, the source is the pair `.claude/settings.json` and
`.claude/settings.local.json`. For a managed file, the source is `managed-settings.json` with the files of
`managed-settings.d/`. The rule never reads across the two. A file that the rule cannot read adds nothing. A denied entry that it holds is the only proof, so the rule reports on the files that it can read.
[`sandbox-domain-syntax`](sandbox-domain-syntax.md) reports an entry that is not a valid domain.

Fail, in `.claude/settings.json`:

```json
{
  "sandbox": {
    "network": {
      "allowedDomains": ["example.com"],
      "deniedDomains": ["example.com"]
    }
  }
}
```

Pass, in `.claude/settings.json`:

```json
{
  "sandbox": {
    "network": {
      "allowedDomains": ["*.example.com"],
      "deniedDomains": ["sensitive.example.com"]
    }
  }
}
```

## Options

None.

## Sources

[^denied]: [All settings: sandbox.network.deniedDomains](https://code.claude.com/docs/en/settings-reference#sandbox-network-denieddomains)
[^allowed]: [All settings: sandbox.network.allowedDomains](https://code.claude.com/docs/en/settings-reference#sandbox-network-alloweddomains)
