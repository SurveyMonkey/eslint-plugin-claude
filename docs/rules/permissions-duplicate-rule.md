---
type: Reference
description: The ESLint rule claude/permissions-duplicate-rule, which reports a permission rule that repeats an earlier rule of the same settings file, in one list or as an ask rule behind an equal deny rule, after it reads :* at the end as a final space and * and a trailing dot in a WebFetch domain as no dot.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-duplicate-rule`

Write each permission rule once in a settings file.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | consistency | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule reads no hidden drop-in in `managed-settings.d`, because Claude Code ignores it.

## Rule details

A rule that appears twice does nothing more than the first copy, and it hides which entry a later edit must change.
Claude Code checks `deny`, then `ask`, then `allow`, and the first match decides.[^order] The rule reads one file. It
compares two rules after it makes them equal in these ways:

- A `:*` at the end of a `Bash`, `Monitor` or `PowerShell` pattern is a final ` *`.[^wildcards] White space between words does not
  matter, and a bare tool name is the same as `Tool(*)`.
- A trailing `.` in a `WebFetch(domain:...)` host is no dot.[^webfetch]

The rule reports each copy, and names the first rule. The first rule is the one that Claude Code checks first: a `deny` rule,
then an `ask` rule, then an `allow` rule, and then the order of the file.

### One report for one fault

[`permissions-dead-allow`](permissions-dead-allow.md) owns an `allow` rule that an equal `deny` or `ask` rule covers. This rule
skips that pair, in the same file or in another file of the same source. So this rule reads:

- the same rule twice in one list;
- an `ask` rule that an equal `deny` rule repeats.

One case is left to this rule: an `allow` rule and a `deny` rule for a `WebFetch` domain that differ in a trailing dot. `permissions-dead-allow`
reads those as two rules, so this rule reports the `allow` rule.

### Limits

- The rule reads one file. The same rule in `settings.json` and in `settings.local.json` gets no report.
- A rule that does not parse is for `permissions-rule-syntax`.
- A path rule is equal only when its text is equal. `Read(./a)` and `Read(a)` are two rules for this rule.

Fail:

```json
{
  "permissions": {
    "allow": ["Bash(ls:*)", "Bash(ls *)"]
  }
}
```

Pass:

```json
{
  "permissions": {
    "allow": ["Bash(ls *)"]
  }
}
```

## Options

None.

## Sources

[^order]: [Configure permissions: Manage permissions](https://code.claude.com/docs/en/permissions#manage-permissions)
[^wildcards]: [Configure permissions: Wildcard patterns](https://code.claude.com/docs/en/permissions#wildcard-patterns)
[^webfetch]: [Configure permissions: WebFetch](https://code.claude.com/docs/en/permissions#webfetch)
