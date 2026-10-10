---
type: Reference
description: The ESLint rule claude/permissions-read-deny-notebook, which reports a Read deny rule with a path and no Edit deny rule for the same path, because a Read deny rule blocks Edit and Write on the path but does not cover NotebookEdit.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-read-deny-notebook`

Add an `Edit` `deny` rule next to a `Read` `deny` rule, because `NotebookEdit` is not covered.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | security | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule reads no hidden drop-in in `managed-settings.d`, because Claude Code ignores it.

## Rule details

A `Read` deny rule also blocks the Edit and Write tools on the same path. "NotebookEdit isn't covered, so add an `Edit` deny rule
for paths no tool may change."[^read] The block of Edit needs v2.1.208 or later, and the block of Write needs v2.1.228 or later.
The gap of NotebookEdit holds for every version.

The rule reports a `Read(<path>)` rule in `deny` when the source has no `Edit` deny rule for the path. The path match is on text:
`./path` and `path` are the same path, and white space around the path does not matter. A bare `Edit` deny rule, or a bare
`NotebookEdit` deny rule, covers every path, because a rule with no path matches at the tool level.[^read] An `Edit` rule in
`allow` or `ask` does not count.

### One source

The rule rests on an absence, so it adds up the `deny` lists of one source. For a project file, the source is the pair
`.claude/settings.json` and `.claude/settings.local.json`. For a managed file, the source is `managed-settings.json` with the
files of `managed-settings.d/`. The rule makes no report when it cannot read a file of the source, because that file can hold
the `Edit` rule. The rule reads no user file.

### What the rule does not check

- An `Edit` deny rule that covers the path with another pattern, such as `Edit(**)` for `Read(./a/**)`. Only an equal path counts.
- A `Read` rule in `allow` or `ask`, a bare `Read` rule, and a parameter rule such as `Read(offset:5)`.
- A `Read(!path)` rule. A `!` pattern carves a path out of a block, so it blocks nothing.
- Whether the path can hold a notebook.

Fail:

```json
{ "permissions": { "deny": ["Read(./secrets/**)"] } }
```

Pass:

```json
{ "permissions": { "deny": ["Read(./secrets/**)", "Edit(./secrets/**)"] } }
```

## Options

None.

## Sources

[^read]: [Configure permissions: Read and Edit](https://code.claude.com/docs/en/permissions#read-and-edit)
