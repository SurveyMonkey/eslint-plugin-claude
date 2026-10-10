---
type: Reference
description: The ESLint rule claude/agent-name-shadowing, which reports a local subagent whose name is also the name of an agent in a .claude/agents directory above it, up to the repository root.
owner: brianespinosa
created: 2026-10-10
related_issues: [9]
stale_after: 2027-04-01
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `agent-name-shadowing`

Do not reuse the name of an agent in a .claude/agents directory above.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | consistency | `**/agents/**/*.md` |

## Rule details

Claude Code finds project subagents from the working directory up to the repository root. It
scans each `.claude/agents/` on the way. When several of these directories define one `name`,
Claude Code uses the definition closest to the working directory.[^scope] So an agent in
`packages/web/.claude/agents/` replaces an agent of the same name in `.claude/agents/`, for a
session that starts in `packages/web/`. That is an override, and it may be on purpose. The rule
makes it visible.

The rule reports in the nearer file, the one that wins. It walks up from the folder of the linted
file, and reads each `.claude/agents/` above it, subfolders included. It stops at the repository
root. The repository root is the first directory at or above `.claude/` that has a `.git` entry.
Without one, the rule reads no folder above. The farther file gets no report. To find it, the
rule would have to scan the whole repository below it.

The rule reads no file out of the repository. It follows a link to a directory once, and not a
link whose real path is out of the repository. A file that it cannot read has no name to compare.
A folder that it cannot list gives fewer files. That can hide a match, and cannot add one.

The rule does not check these cases:

- Two files under one `.claude/agents/` directory with one name.
  [`agent-name-unique`](agent-name-unique.md) reports them.
- A name that is the name of a built-in subagent.
  [`agent-name-shadows-builtin`](agent-name-shadows-builtin.md) reports it.
- A plugin agent. Its scoped name has the plugin name, so it does not clash with a local agent.
  [`agent-plugin-scoped-name-unique`](agent-plugin-scoped-name-unique.md) checks the names in one
  plugin.
- The same name in `~/.claude/agents/`, in managed settings, or in a plugin. The rule cannot see
  those sources.
- A file with no `name`, an empty `name`, or a `name` that is not a string.

Fail, `.claude/agents/review.md` and `packages/web/.claude/agents/review.md` with `name: reviewer`.
The rule reports the second file.

Pass: the two files with `name: reviewer` and `name: web-reviewer`.

## Options

None.

## Sources

[^scope]: [Create custom subagents: Choose the subagent scope](https://code.claude.com/docs/en/sub-agents#choose-the-subagent-scope)
