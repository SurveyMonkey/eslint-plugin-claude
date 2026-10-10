---
type: Reference
description: The ESLint rule claude/permissions-webfetch-mid-wildcard, which reports a WebFetch domain rule in allow or deny with a wildcard other than a leading *. or a bare *, such as domain:example.*, when sandbox.enabled is true in the same file, because the sandbox ignores it.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-webfetch-mid-wildcard`

Use only a leading `*.` or a bare `*` in a `WebFetch` domain while the sandbox is on.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule reads no hidden drop-in in `managed-settings.d`, because Claude Code ignores it.

## Rule details

In a `WebFetch(domain:...)` rule, the sandbox honors two wildcard forms: a leading `*.`, such as `*.example.com`, and a bare `*`.
A wildcard in any other position, such as `WebFetch(domain:example.*)`, "still matches fetches but has no effect on sandboxed
commands".[^sandbox] There the `*` matches only the text between two dots.[^webfetch] Claude Code adds the domain of a `WebFetch(domain:...)` rule in `allow` or
`deny` to the allowed or denied domain list of the sandbox.[^webfetch]

The rule reports a `WebFetch(domain:<host>)` rule in `allow` or `deny` when `<host>` has a `*` that is not a leading `*.` or the
whole host, and `sandbox.enabled` is `true` in the same file. These hosts get a report: `example.*`, `a.*.com`, `ex*.com`, `*.example.*`
and `*example.com`. A person who writes the rule can expect the sandbox to apply it to a command such as `curl`.

The rule reads `sandbox.enabled` in the file that it lints, and in no other file. A value that is not the Boolean `true`,
including the quoted `"true"`, gives no report. An `ask` rule is not read, because the sandbox adds no domain from it.

### One report for one fault

- An `allow` rule that an equal `deny` or `ask` rule, or a bare `WebFetch` rule, covers is for `permissions-dead-allow`. This rule
  skips it.
- A host that is not a hostname is for `permissions-webfetch-domain-syntax`. That rule accepts a wildcard in any position.

Fail:

```json
{ "permissions": { "allow": ["WebFetch(domain:example.*)"] }, "sandbox": { "enabled": true } }
```

Pass:

```json
{ "permissions": { "allow": ["WebFetch(domain:*.example.com)"] }, "sandbox": { "enabled": true } }
```

## Options

None.

## Sources

[^webfetch]: [Configure permissions: WebFetch](https://code.claude.com/docs/en/permissions#webfetch)
[^sandbox]: [Configure the sandboxed Bash tool: Network isolation](https://code.claude.com/docs/en/sandboxing#network-isolation)
