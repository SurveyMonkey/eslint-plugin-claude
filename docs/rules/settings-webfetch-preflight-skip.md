---
type: Reference
description: The ESLint rule claude/settings-webfetch-preflight-skip, which reports skipWebFetchPreflight set to true when no WebFetch permission rule with a domain exists in the file or in the files that Claude Code merges with it.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-webfetch-preflight-skip`

Pair `skipWebFetchPreflight: true` with a `WebFetch(...)` permission rule.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | security | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

`skipWebFetchPreflight: true` skips the WebFetch domain safety check. Then WebFetch attempts any
URL without the blocklist. The settings reference says to pair the key with `WebFetch` permission
rules when you need to restrict the domains that Claude can reach.[^skip] The permissions page
describes the form `WebFetch(domain:example.com)`.[^webfetch]

The rule reports the value `true`. It makes no report when a `WebFetch` rule with a specifier
exists in `permissions.allow`, `permissions.ask` or `permissions.deny` of one of these files:

- The linted file.
- For a project file, the other project file of the same `.claude/` folder.
- For a managed file, the other files of the managed source: `managed-settings.json` and each
  drop-in in `managed-settings.d/` that is not hidden.

`permissions` is a list key, so the rule reads each file on its own and does not merge them. A bare
`WebFetch` and `WebFetch()` name no domain, so they do not count.

The rule reads no path out of the repository (ADR 001, Decision 14). It makes no report when it
cannot see a file that Claude Code merges with the linted file: a file that does not parse to an
object, a read that fails, a link that has no target, and a link that leads out of the repository.
That file can hold the rule.

### What the rule does not check

- A rule in user settings, in another `.claude/` folder, or in a file passed with `--settings`.
  The rule cannot see them, or Claude Code does not merge them with the linted file.
- What a `WebFetch` rule restricts. Any rule with a specifier counts, also an allow entry for
  all domains.
- The values `false` and `null`, and a value that is not a Boolean. `settings-schema` reports
  the type.
- A hidden drop-in, which Claude Code ignores.

Fail:

```json
{
  "skipWebFetchPreflight": true
}
```

Pass:

```json
{
  "skipWebFetchPreflight": true,
  "permissions": {
    "allow": ["WebFetch(domain:docs.example.com)"]
  }
}
```

## Sources

[^skip]: [All settings: skipWebFetchPreflight](https://code.claude.com/docs/en/settings-reference#skipwebfetchpreflight)
[^webfetch]: [Configure permissions: WebFetch](https://code.claude.com/docs/en/permissions#webfetch)
