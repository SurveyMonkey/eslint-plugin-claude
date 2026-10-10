---
type: Reference
description: The ESLint rule claude/sandbox-domain-duplicate, which reports an entry of a sandbox allowedDomains or deniedDomains list that repeats an earlier entry of the same list in one settings file, after it reads letter case and one final dot as the same.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `sandbox-domain-duplicate`

Write each domain once in an `allowedDomains` or `deniedDomains` list.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule skips a hidden drop-in in `managed-settings.d`, because Claude Code ignores it.

## Rule details

A list that holds a domain twice has a redundant entry. The rule reports each entry after the first, and names the first.
The rule ignores letter case and one final dot. An entry with the final dot, such as `example.com.`, blocks the same
connections as `example.com`.[^denied] The docs state this for `deniedDomains`, and say that `deniedDomains` has the same
syntax as `allowedDomains`.[^denied] So the rule uses one comparison for both lists.

An entry with a port is a different entry from one without a port. An entry with no port matches every port.[^allowed] The
rule compares a wildcard as text.

### One file and one list

The rule reads one file, and each list alone. It does not add up the files of a source. It does not compare the two lists:
`sandbox-domain-overlap` reports a domain that both lists hold. `sandbox-domain-syntax` reports an entry that is not a valid
domain. This rule reports such an entry too when it stands twice, which is a different fault.

Fail:

```json
{ "sandbox": { "network": { "allowedDomains": ["example.com", "example.com."] } } }
```

Pass:

```json
{ "sandbox": { "network": { "allowedDomains": ["example.com", "example.com:443", "*.example.com"] } } }
```

## Options

None.

## Sources

[^denied]: [All settings: sandbox.network.deniedDomains](https://code.claude.com/docs/en/settings-reference#sandbox-network-denieddomains)
[^allowed]: [All settings: sandbox.network.allowedDomains](https://code.claude.com/docs/en/settings-reference#sandbox-network-alloweddomains)
