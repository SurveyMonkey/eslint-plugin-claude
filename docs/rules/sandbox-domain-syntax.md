---
type: Reference
description: The ESLint rule claude/sandbox-domain-syntax, which reports a sandbox.network.allowedDomains or deniedDomains entry that is not a hostname, a wildcard pattern or an IP literal with an optional port, such as one with a URL scheme, a path, user info, a port with a leading zero or an IPv6 address with no brackets.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `sandbox-domain-syntax`

Write each `sandbox.network.allowedDomains` and `deniedDomains` entry as a host with an optional port.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule also lints the managed settings files: `managed-settings.json` and each `managed-settings.d/*.json` drop-in.
It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

An entry is a domain, a wildcard pattern such as `*.example.com`, or an IP literal. It can end in `:port`. An entry with no port
matches every port.[^allowed] `deniedDomains` has the same wildcard, port and IPv6 syntax.[^denied] A person writes an IPv6
literal in brackets, as `[::1]` or `[::1]:443`. The bracketed form needs Claude Code v2.1.229 or later.[^ipv6]

The rule makes one report for an entry, for the first fault in this order:

1. **A scheme**, as in `https://github.com`.
2. **A path, a query or a fragment**, as in `github.com/anthropics`. The rule reports any `/`, `?` or `#`.
3. **An IPv6 address with no brackets**, as `::1` or `::1:443`. Claude Code cannot tell it from a host and a port. A deny list
   blocks each reading, and an allow list can drop the entry.[^ipv6]
4. **Text that is not a host**: an empty host, or a host with white space, `@` or `\`, or text with a `:` that is not a port
   separator. An IPv6 literal with a wildcard inside the brackets, such as `[*::1]`, is in this group.
5. **A port that is not valid.** A port is a whole number from 1 to 65535. `a.com:0` and `a.com:65536` fail. The docs state no
   range and no rule on leading zeros. The rule reads a port as a TCP port, so it does not report `a.com:080`.

The rule is silent in these cases:

- The entry is a hostname, a wildcard in any position, `*`, an IPv4 address, or a name with a `.` at the end.[^denied] The
  rule does not check where a wildcard stands.
- The entry is a bracketed IPv6 address, with or without a port.
- The entry is not a string, or the list is not an array. `sandbox-schema` reports the type.

### A managed file

Claude Code drops an invalid entry of a managed list and keeps the rest. While `deniedDomains`, or an entry of it, is invalid,
Claude Code also withholds `sandbox.network.allowedDomains`, so the managed allow list grants nothing.[^managed] The message for
an entry of `deniedDomains` in a managed file says so, except for an address with no brackets. The docs say that Claude Code
reads such an address, so they do not call it invalid. This repair needs Claude Code v2.1.283 or later.

The rule reads the last of two keys of one name, as `JSON.parse` does.

### One report for one fault

The `WebFetch(domain:...)` rules of `permissions.allow` feed the same lists. [`permissions-webfetch-domain-syntax`](permissions-webfetch-domain-syntax.md)
reports those rules. It shares its host checks with this rule, and it refuses any port. This rule accepts a port. The place of a
wildcard is not checked by either rule.

Fail:

```json
{ "sandbox": { "network": { "allowedDomains": ["https://github.com", "api.example.com:080", "::1"] } } }
```

Pass:

```json
{ "sandbox": { "network": { "allowedDomains": ["github.com", "*.npmjs.org", "api.example.com:443", "[::1]:443"] } } }
```

## Options

None.

## Sources

[^allowed]: [All settings: sandbox.network.allowedDomains](https://code.claude.com/docs/en/settings-reference#sandbox-network-alloweddomains)
[^denied]: [All settings: sandbox.network.deniedDomains](https://code.claude.com/docs/en/settings-reference#sandbox-network-denieddomains)
[^ipv6]: [Configure the sandboxed Bash tool: IPv6 addresses in domain lists](https://code.claude.com/docs/en/sandboxing#ipv6-addresses-in-domain-lists)
[^managed]: [Deploy managed settings: Invalid values inside sandbox](https://code.claude.com/docs/en/managed-settings#invalid-values-inside-sandbox)
