---
type: Reference
description: The ESLint rule claude/memory-agent-memory-local-untracked, which reports each Markdown file in .claude/agent-memory-local/ that git tracks, because the local memory scope of a subagent is for knowledge that stays out of version control.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `memory-agent-memory-local-untracked`

Keep the local memory of a subagent out of git.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude/agent-memory-local/**/*.md` |

## Rule details

A subagent can keep memory between sessions. The `memory` field of the agent sets the scope. The
`local` scope stores the memory in `.claude/agent-memory-local/<name-of-agent>/`. The docs say
to use it for knowledge of the project that must stay out of version control.[^memory] The `project` scope, in `.claude/agent-memory/`, is the one that a team shares.

A file that git tracks in the `local` directory breaks that rule. The rule reports each such
file.

The lint target is the memory file itself. The other rules of this group lint a file in the
same directory. Here a tracked file is in each clone, so ESLint can lint it. A memory file that git
does not track is the intended state. The rule makes no report for it. The rule reports one
message at the start of the file. The message names the path from the repository root.

The rule reads Markdown files only. Claude Code writes `MEMORY.md` and its topic files as
Markdown. A tracked file of another type in the directory is not linted, so the rule cannot
see it.

The answer comes from the git index, as in [`claude-md-local-untracked`](claude-md-local-untracked.md).
A `.gitignore` pattern does not change it, because a pattern does not untrack a file that git
already tracks.

The rule makes no report when it cannot read git (ADR 001, Decision 14):

- There is no `.git` entry at or above the file.
- `git` is not installed, or a `git` command fails.
- A `.git` entry that is not a repository lies inside another repository.
- The memory directory is a link to a place out of the repository.

A memory directory that is a link to a directory of the repository is read where it leads.

Fail: `.claude/agent-memory-local/reviewer/MEMORY.md` in the index.

Pass: the same file after `git rm --cached`, with `.claude/agent-memory-local/` in `.gitignore`.
A file in `.claude/agent-memory/` is not read.

## Options

None.

## Sources

[^memory]: [Create custom subagents: Enable persistent memory](https://code.claude.com/docs/en/sub-agents#enable-persistent-memory)
