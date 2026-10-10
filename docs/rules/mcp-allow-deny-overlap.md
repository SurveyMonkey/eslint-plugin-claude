---
type: Reference
description: The ESLint rule claude/mcp-allow-deny-overlap, which reports an allowedMcpServers entry that deniedMcpServers also holds across the settings files of one place, because the denylist takes precedence and the allow entry has no effect.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-allow-deny-overlap`

Do not list one entry in both `allowedMcpServers` and `deniedMcpServers`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | consistency | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

A `deniedMcpServers` entry takes precedence over `allowedMcpServers`, so a server on both lists is
blocked.[^allowed][^denied] The allow entry then has no effect. The author most likely believes
that the server is allowed. Entries from every file merge into one allowlist and one
denylist.[^allowed][^denied]

The rule compares entries. Two entries are the same when they have the same kind and the same
value. The kinds are a `serverName` string, a `serverUrl` string, and a `serverCommand` array of
strings. A `serverName` is not a `serverUrl` with the same text.

An entry that Claude Code strips is not an entry, so it never overlaps. This holds for an entry
with more than one key and for a value of the wrong type. It holds for an allowlist `serverName`
that breaks the pattern of letters, numbers, hyphens and underscores.
[`mcp-policy-entry-schema`](mcp-policy-entry-schema.md) reports those entries.

The rule sums the lists of the files that merge. For a project file, these are the two project
files of one `.claude/` folder. For a managed file, these are the files of one managed source. A
project file is not summed with a managed file.

The rule reports each allow entry of the linted file that a denylist also holds. The denylist is
in the linted file or in a sibling. The report is on the allow entry. A pair gets one report, in
the file that holds the allow entry.

The rule reports only from what the repository holds. A user file merges at run time too, and the
rule does not read it. A sibling that the rule cannot read adds nothing (ADR 001, Decision 14).
A managed source with one such file gives no sibling, so the rule then reports from the linted
file alone.

The rule reads no hidden drop-in, because Claude Code ignores it. When a file has two lists of one
name, the rule reads the last, as `JSON.parse` does. It does the same for two keys of one name in
an entry.

An entry in a denylist that no allow entry matches is not an overlap. A denylist `serverUrl`
pattern that covers a different allowed URL is also not an overlap. The rule compares text, and it
does not match a pattern.

Fail:

```json
{
  "allowedMcpServers": [{ "serverName": "github" }],
  "deniedMcpServers": [{ "serverName": "github" }]
}
```

Pass: remove `github` from one of the two lists.

## Sources

[^allowed]: [All settings: allowedMcpServers](https://code.claude.com/docs/en/settings-reference#allowedmcpservers)
[^denied]: [All settings: deniedMcpServers](https://code.claude.com/docs/en/settings-reference#deniedmcpservers)
