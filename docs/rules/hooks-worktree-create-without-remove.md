---
type: Reference
description: The ESLint rule claude/hooks-worktree-create-without-remove, which reports a file with a WorktreeCreate hook and no WorktreeRemove hook, because Claude Code then removes only a worktree that git knows.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-worktree-create-without-remove`

Pair a WorktreeCreate hook with a WorktreeRemove hook in the same file.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

A `WorktreeCreate` hook replaces the default git behavior of Claude Code. The hooks reference says to pair it
with a `WorktreeRemove` hook for the cleanup of its worktrees.[^remove]

Without a `WorktreeRemove` hook, Claude Code runs `git worktree remove --force` on the path that the create hook
returned. That removes a worktree that git knows. A worktree that git does not know stays on disk. An example
is a worktree that the hook made with another version control system. Claude Code also never deletes a branch
of a hook-created worktree.[^remove]

The rule reports a file that has a `WorktreeCreate` handler and no `WorktreeRemove` handler. It reports once,
at the `WorktreeCreate` event name. The source is one file. The rule does not see a `WorktreeRemove` hook in
another file. So it can report a pair that two files complete together. Turn the rule off for that layout.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, no plugin agent, and no `hooks.json` that Claude Code does not read.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "WorktreeCreate": [{ "hooks": [{ "type": "command", "command": "./create-worktree.sh" }] }]
  }
}
```

Pass:

```json
{
  "hooks": {
    "WorktreeCreate": [{ "hooks": [{ "type": "command", "command": "./create-worktree.sh" }] }],
    "WorktreeRemove": [{ "hooks": [{ "type": "command", "command": "./remove-worktree.sh" }] }]
  }
}
```

## Sources

[^remove]: [Hooks reference: WorktreeRemove](https://code.claude.com/docs/en/hooks#worktreeremove)
