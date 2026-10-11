---
type: Reference
description: The ESLint rule claude/claude-md-excludes-absolute-committed, off in recommended and warn in strict, which reports a claudeMdExcludes pattern in the committed .claude/settings.json that starts with the folder of one machine, such as /Users/name or C:\Users, because every clone shares it.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `claude-md-excludes-absolute-committed`

Keep a machine-specific `claudeMdExcludes` path out of the committed settings.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | portability | `**/.claude/settings.json` |

The rule is `off` in `recommended`.

## Rule details

`claudeMdExcludes` skips CLAUDE.md files by path or glob. Claude Code matches each pattern against
absolute file paths. The docs example puts the setting in `.claude/settings.local.json`, so that the
exclusion stays on one machine.[^exclude] The guide for large codebases gives the same advice for
the files of other teams.[^large] A pattern with a home folder, such as `/Users/name/work/**`,
matches nothing on the machine of another person. The committed file reaches every clone.

The rule reports a pattern in `claudeMdExcludes` of `.claude/settings.json` that starts with the
path of one machine:

- A Unix path whose first folder name has no glob character, such as `/Users/x/work/CLAUDE.md` or
  `/home/user/monorepo/**`.
- A Windows drive path, such as `C:\work\**` or `d:/work/CLAUDE.md`.
- A Windows share, such as `\\server\share\CLAUDE.md`.

The rule makes no report on a pattern that starts with `**/`, with `**`, or with a glob in the
first folder name, such as `/**/CLAUDE.md`. It makes no report on a relative pattern.
`claude-md-excludes-pattern` reports that.

The rule reads `.claude/settings.json` only. It does not read `.claude/settings.local.json`, which is
not committed, and it does not read a managed settings file, which an administrator sets for one
organization. The rule is a heuristic. A team can keep one path on every machine, for example
`/workspace/monorepo/**` in a container, and the rule reports that too.

Fail:

```json
{ "claudeMdExcludes": ["/Users/name/work/other-team/CLAUDE.md"] }
```

Pass:

```json
{ "claudeMdExcludes": ["**/other-team/CLAUDE.md"] }
```

## Sources

[^exclude]: [How Claude remembers your project: Exclude specific CLAUDE.md files](https://code.claude.com/docs/en/memory#exclude-specific-claude-md-files)
[^large]: [Monorepos and large repos: Exclude irrelevant CLAUDE.md files](https://code.claude.com/docs/en/large-codebases#exclude-irrelevant-claude-md-files)
