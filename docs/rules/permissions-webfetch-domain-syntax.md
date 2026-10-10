---
type: Reference
description: The ESLint rule claude/permissions-webfetch-domain-syntax, which reports a WebFetch rule that is not domain:<host>, such as one with a URL scheme, a path, a port or no domain prefix, because Claude Code matches the hostname of the requested URL.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-webfetch-domain-syntax`

Write a `WebFetch` rule as `domain:<host>`, with a hostname or a wildcard only.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule also lints the managed settings files: `managed-settings.json` and each `managed-settings.d/*.json` drop-in.
It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

`WebFetch` rules use a `domain:` prefix and match against the hostname of the requested URL. The match is
case-insensitive, supports `*` wildcards, and strips a `.` at the end from the rule and the hostname.[^webfetch] The rule
format table of the tools reference gives `WebFetch(domain:example.com)` as the form.[^tools]

The rule reads `WebFetch` rules with a specifier in `allow`, `ask` and `deny`. It makes one report for an entry, for
the first fault in this order:

1. **A scheme**, as in `WebFetch(domain:https://example.com)` or `WebFetch(https://example.com/docs)`.
2. **A path, a query or a fragment**, as in `domain:example.com/docs`. The rule reports any `/`, `?` or `#`.
3. **A port**, as in `domain:example.com:8080` or `domain:[::1]:8080`.
4. **Text that is not a hostname**: an empty host, or a host with white space, `@`, `:` or `\`.
5. **No `domain:` prefix**, as in `WebFetch(example.com)`. This applies when the specifier is not a parameter rule.

The rule is silent in these cases:

- The host is a hostname or a wildcard in any position: `example.com`, `*.example.com`, `*`, `example.*`. The rule does not
  check where the wildcard stands. Upper case, a `.` at the end, an IPv4 address, a bracketed IPv6 address such as
  `[::1]`, and a name with no dot are valid.
- The rule has no specifier. A bare `WebFetch` rule is valid.[^every]
- The rule is a parameter rule in `deny` or `ask` whose name is not `domain`, as in `WebFetch(prompt:*)`. A parameter
  rule for `url`, the primary field, is for [`permissions-param-rule`](permissions-param-rule.md). A rule with another
  parameter is a parameter rule, and no rule reads it.
- The tool is not `WebFetch`. A skill file is not read, because the row names settings files only.

### One report for one fault

- A string that does not parse is for [`permissions-rule-syntax`](permissions-rule-syntax.md).
- `WebFetch(domain:*)` in `allow` is for [`permissions-allow-unrestricted`](permissions-allow-unrestricted.md). This rule
  accepts `*` as a wildcard.
- This rule does not check the place of a wildcard, and it does not check that a rule for `*.example.com` has a rule
  for `example.com`.

The rule reads the last of two keys of one name, as `JSON.parse` does. It skips an entry that is not a string.

Fail:

```json
{ "permissions": { "allow": ["WebFetch(domain:https://example.com)", "WebFetch(example.com)"] } }
```

Pass:

```json
{ "permissions": { "allow": ["WebFetch(domain:example.com)", "WebFetch(domain:*.example.com)"] } }
```

## Options

None.

## Sources

[^webfetch]: [Configure permissions: WebFetch](https://code.claude.com/docs/en/permissions#webfetch)
[^every]: [Configure permissions: Allow or deny every fetch](https://code.claude.com/docs/en/permissions#allow-or-deny-every-fetch)
[^tools]: [Tools reference: Configure tools with permission rules and hooks](https://code.claude.com/docs/en/tools-reference#configure-tools-with-permission-rules-and-hooks)
