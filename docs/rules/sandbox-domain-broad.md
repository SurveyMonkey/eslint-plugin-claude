---
type: Reference
description: The ESLint rule claude/sandbox-domain-broad, a heuristic that reports a sandbox allowedDomains entry that allows every host or a whole top-level domain, and a host that the option broad lists, because a broad domain opens a path for data exfiltration and domain fronting.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# claude/sandbox-domain-broad

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| security | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule is `off` in `recommended`. It is a heuristic, so `strict` turns it on at `warn`.

## Rule details

The sandbox proxy decides from the hostname that the client gives, and by default it does not inspect TLS. The docs warn that
"allowing broad domains such as `github.com` can create paths for data exfiltration", and that code in the sandbox can use domain
fronting to reach hosts outside the list.[^limits]

The rule reads `sandbox.network.allowedDomains`, and reports two shapes:

- `wildcard`: the host `*`, and a wildcard on one label, such as `*.com` or `*.io`. A port does not change this. The rule
  cannot read the public suffix list, so `*.co.uk` gets no report.
- `listed`: a host that the option `broad` lists.

The docs name `github.com` as an example of a broad domain, and they also use it as an `allowedDomains` entry in two
examples.[^allowed][^sandbox] A default report on it would report the docs example, so the default list is empty. Add
`github.com` to `broad` if your policy treats it as broad.

### What the rule does not report

- `deniedDomains`, and the `WebFetch(domain:...)` rules.
- A subdomain of a listed host. `broad` matches the host of an entry, in lower case, with no port and no final dot.
- An entry that `sandbox-domain-syntax` owns: a URL scheme, a path, or a name that is not a host. Such an entry does not have
  the two shapes above. A wildcard with a bad port still reports, because its breadth is a fault of its own.

Fail:

```json
{ "sandbox": { "network": { "allowedDomains": ["*.com"] } } }
```

Pass:

```json
{ "sandbox": { "network": { "allowedDomains": ["*.npmjs.org", "api.example.com:443"] } } }
```

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/sandbox-domain-broad': 'warn'
```

## Options

<!-- begin auto-generated rule options list -->
<!-- end auto-generated rule options list -->

`broad` is an array of hosts. The default is `[]`.

```json
{ "claude/sandbox-domain-broad": ["warn", { "broad": ["github.com"] }] }
```

## Sources

[^limits]: [Configure the sandboxed Bash tool: Security limitations](https://code.claude.com/docs/en/sandboxing#security-limitations)
[^allowed]: [All settings: sandbox.network.allowedDomains](https://code.claude.com/docs/en/settings-reference#sandbox-network-alloweddomains)
[^sandbox]: [All settings: sandbox](https://code.claude.com/docs/en/settings-reference#sandbox)
