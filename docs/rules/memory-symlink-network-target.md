---
type: Reference
description: The ESLint rule claude/memory-symlink-network-target, which reports a CLAUDE.md, a rule file or a folder in .claude/rules that is a link to a UNC share, /net or /Network, because Claude Code does not follow such a link.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `memory-symlink-network-target`

Do not link a `CLAUDE.md` or a rule to a network path.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/CLAUDE.md`, `**/.claude/rules/**/*.md` |

## Rule details

Claude Code reads a `CLAUDE.md` or a file in `.claude/rules/` through a link. If the link leads to
a network path, it does not follow the link, because a lookup of such a path can contact the host
that it names. The instructions in the target do not load.[^symlinks] The docs name two kinds of
network path: the UNC share `\\server\share`, and a path under `/net` or `/Network`. They say that
`\\wsl$` paths do not count as network paths.[^symlinks]

The rule reports a file when one of these is a link with such a target:

- The file, when it is a `CLAUDE.md` or `.claude/CLAUDE.md`.
- The file, when it is a rule file. The report is the same for the `.claude/rules` folder, and for
  each folder below it, because a link to a folder moves the files below it.

The rule reads the text of the link and nothing else. It never follows the link, so it contacts no
host. It stops at the first link of that kind, because a look at a path below it would follow the
link.

Fail:

```text
CLAUDE.md -> \\server\share\team\CLAUDE.md
.claude/rules/shared -> /net/fileserver/rules
```

Pass:

```text
CLAUDE.md -> AGENTS.md
.claude/rules/shared -> \\wsl$\Ubuntu\home\me\rules
```

The rule reads a target as a network path in these cases:

- It starts with two backslashes and a host, such as `\\server\share` or `\\10.0.0.5\share`, in any
  letter case. The form `\\?\UNC\server\share` is also a share.
- It is `/net` or `/Network`, or starts with `/net/` or `/Network/`. The case matters.

It does not read these as network paths:

- `\\wsl$` and `\\wsl.localhost`. The docs name the first one. The second one is the other name of
  the same machine-local path, and the docs do not name it, so the rule makes no report for it.
- `\\?\C:\...` and `\\.\pipe\...`. They are local.
- `//server/share`. The docs name the backslash form. On Linux and macOS, `//server` is the same
  as `/server`.
- A relative target. The rule does not resolve a target.

## Limits

ESLint reads each file that a `files` glob matches. A link that leads nowhere stops ESLint with an
error before any rule runs. So on a machine where the network path does not answer, ESLint stops
first. The rule reports a link whose target answers, such as a share that is mounted.

The rule looks at the `CLAUDE.md` and the rule files that ESLint lints. It checks the links in the
path from `.claude/rules` down. It does not check `CLAUDE.local.md`, `AGENTS.md` or a link above
`.claude/rules`, because the docs name the other two places only. A local link that leads to
another link, and then to the network, is not seen.

## Sources

[^symlinks]: [How Claude remembers your project: Share rules across projects with symlinks](https://code.claude.com/docs/en/memory#share-rules-across-projects-with-symlinks)
