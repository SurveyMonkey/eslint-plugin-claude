---
type: Reference
description: The ESLint rule claude/permissions-webfetch-apex, which reports a WebFetch rule for domain:*.example.com when the same list of the settings source has no rule for example.com, because the wildcard rule does not match the apex domain.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-webfetch-apex`

Add a `WebFetch` rule for the apex domain next to a wildcard subdomain rule.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule reads no hidden drop-in in `managed-settings.d`, because Claude Code ignores it.

## Rule details

`WebFetch(domain:*.example.com)` matches any subdomain at any depth, such as `api.example.com` or `a.b.example.com`, but not
`example.com` itself.[^webfetch] To cover the apex domain, add `WebFetch(domain:example.com)`.[^webfetch]

The rule reports a rule `WebFetch(domain:*.<host>)` in `allow`, `ask` or `deny` when the same list has no rule that covers
`<host>`. These rules cover it: `WebFetch(domain:<host>)`, `WebFetch(domain:*)` and a bare `WebFetch`. Matching ignores case and
one `.` at the end of the rule and the host.[^webfetch] A rule in another list does not count: an `allow` rule for the apex does
not cover a `deny` rule for the wildcard.

### One source

The rule rests on an absence, so it adds up each list over one source. For a project file, the source is the pair
`.claude/settings.json` and `.claude/settings.local.json`. For a managed file, the source is `managed-settings.json` with the
files of `managed-settings.d/`. The rule makes no report when it cannot read a file of the source, because that file can hold
the apex rule. The rule reads no user file.

### One report for one fault

- An `allow` rule that an equal `deny` or `ask` rule, or a bare `WebFetch` `deny` or `ask` rule, covers is for `permissions-dead-allow`. This rule
  skips it.
- `WebFetch(domain:*)` is for `permissions-allow-unrestricted` in `allow`, and it has no `*.` form.
- The place of a wildcard that is not a leading `*.` is for `permissions-webfetch-mid-wildcard`. This rule skips a host with another `*`.
- A rule with no `domain:` prefix is for `permissions-webfetch-domain-syntax`. So is a host with a port, a path, a query or a
  scheme, such as `*.example.com:443`. This rule skips them, and a host with white space or an empty label such as `*..example.com`.

Fail:

```json
{ "permissions": { "allow": ["WebFetch(domain:*.example.com)"] } }
```

Pass:

```json
{ "permissions": { "allow": ["WebFetch(domain:*.example.com)", "WebFetch(domain:example.com)"] } }
```

## Options

None.

## Sources

[^webfetch]: [Configure permissions: WebFetch](https://code.claude.com/docs/en/permissions#webfetch)
