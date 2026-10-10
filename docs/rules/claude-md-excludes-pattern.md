---
type: Reference
description: The ESLint rule claude/claude-md-excludes-pattern, which reports a claudeMdExcludes pattern that does not start with a slash, a Windows drive or **/, because Claude Code matches the patterns against absolute file paths and the pattern matches none.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `claude-md-excludes-pattern`

Start each `claudeMdExcludes` pattern at the root or with `**/`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

`claudeMdExcludes` lists the CLAUDE.md files that Claude Code skips. Each entry is a glob pattern
or an absolute path. Claude Code matches the patterns against absolute file paths.[^memory][^ref]
A pattern such as `packages/web/**` starts with a name, so it matches no absolute path. Claude
Code shows no error, and it loads the files that you meant to skip. The large codebases guide says
to start a relative-style pattern with `**/`.[^guide]

The rule reports a string entry that does not start in one of these ways:

- `/`, for an absolute path on macOS and Linux.
- `**/`, for a pattern that matches anywhere in the tree.
- A Windows drive and a separator, such as `C:\` or `C:/`.
- Two backslashes, for a Windows share.

The pattern `**` alone matches every absolute path, so the rule accepts it. The docs do not say that
Claude Code expands `~/` in these patterns, so the rule reports an entry that starts with `~/`.

The report is on the entry. The rule ignores a `claudeMdExcludes` value that is not an array, and an
entry that is not a string. [`memory-settings-schema`](memory-settings-schema.md) reports those.
If a file sets the key twice, the rule reads the last one, as `JSON.parse` does. It makes no report
on a hidden drop-in in `managed-settings.d/`, because Claude Code ignores that file.

Fail:

```json
{
  "claudeMdExcludes": ["packages/web/**"]
}
```

Pass:

```json
{
  "claudeMdExcludes": ["**/packages/web/**", "/home/user/monorepo/legacy/CLAUDE.md"]
}
```

## Options

None.

## Sources

[^memory]: [How Claude remembers your project: Exclude specific CLAUDE.md files](https://code.claude.com/docs/en/memory#exclude-specific-claude-md-files)
[^ref]: [Settings reference: claudeMdExcludes](https://code.claude.com/docs/en/settings-reference#claudemdexcludes)
[^guide]: [Monorepos and large repos: Exclude irrelevant CLAUDE.md files](https://code.claude.com/docs/en/large-codebases#exclude-irrelevant-claude-md-files)
