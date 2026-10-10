---
type: Reference
description: The ESLint rule claude/permissions-protected-path-allow, which reports an Edit allow rule for a protected path such as .claude or .git, an allowWrite entry for a protected path of the sandbox, and a Bash allow rule for rm on a critical path, because Claude Code never honors each of them.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-protected-path-allow`

Do not allow a write to a protected path, or the removal of a critical path.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule also lints the managed settings files: `managed-settings.json` and each `managed-settings.d/*.json` drop-in.
It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

The rule reports three forms that Claude Code never honors.

**An `Edit` allow rule for a protected path.** Claude Code never auto-approves a write to a small set of paths. The
exception is `bypassPermissions` mode, and interactive plan mode when bypass is available.[^protected] The safety check runs before Claude Code evaluates allow rules from
settings. An entry such as `Edit(.claude/**)` does not change the result.[^protected]

The protected directories are `.git`, `.config/git`, `.vscode`, `.idea`, `.husky`, `.cargo`, `.devcontainer`, `.yarn`,
`.mvn` and `.claude`. The protected files include `.gitconfig`, `.bashrc`, `.zshrc`, `.envrc`, `.npmrc`, `lefthook.yml`,
`.mcp.json` and `.claude.json`. The rule holds the lists of the docs. It cannot hold a directory that you load with `--plugin-dir`.

The docs name exceptions under `.claude`, "such as" these. The rule does not report a pattern at or under
`.claude/worktrees`, `.claude/plans`, `.claude/jobs/<id>/tmp`, `.claude/projects/<project>/memory` or
`.claude/agent-memory`. The docs limit the memory exceptions to Markdown files, and the rule cannot tell, so it skips
the whole directory.

The rule reports an `Edit` entry when the path starts at a protected path. It skips the anchor (`~/`, `/`, `./`) and any
`**` at the start. These are reports: `Edit(.claude/**)`, `Edit(**/.git/**)`, `Edit(~/.zshrc)` and `Edit(.mcp.json)`.

The rule is silent in these cases:

- The pattern does not start at a protected path, as in `Edit(src/.git/**)`.
- The pattern is above a protected path, as in `Edit(**)`. It also covers paths that Claude Code can pre-approve.
- The pattern starts with `//`, and the next segment is not `**`. The rule cannot tell which directory it names.

**An `allowWrite` entry for a protected path of the sandbox.** The sandbox denies writes to the files from which Claude
Code loads configuration and code. "An `allowWrite` entry can't lift a protected path."[^sandbox][^allowwrite]

The rule reads `sandbox.filesystem.allowWrite` in a project or local file. It reports an entry that is at or under one
of these paths:

- `.claude/settings.json`, `.claude/settings.local.json`, `.claude/skills`, `.claude/agents` and `.claude/commands`
- `.claude/hooks`, `.claude/workflows` and `.claude/scheduled_tasks.json`
- `.mcp.json`, `.bashrc`, `.zshrc`, `.gitconfig`, `.vscode` and `.idea`
- `.git/hooks` and `.git/config`

The sandbox list is not the list of the permission check, so the rule keeps the two lists apart. It stays silent in
these cases:

- The entry is above a protected path, as in `.claude`. It also allows other paths, so it has some effect.
- The entry starts with `/`, `//` or `~`. The rule cannot tell which directory it names.
- The entry has a wildcard, other than a final `/**`. The docs do not say which paths such an entry covers.[^allowwrite]
- The file is a managed file. The docs do not say what a relative path means in managed settings.[^allowwrite]

**A `Bash` allow rule for `rm` or `rmdir` on a critical path.** Claude Code never lets an allow rule approve an `rm` or
`rmdir` command that targets a critical path.[^critical] The rule reads `Bash` rules. It reports a rule with no wildcard whose target is a
literal critical path: `/`, `~`, `$HOME`, `${HOME}` or `.`. It also reports a direct child of the root such as `/usr`,
and `..`. The docs do not name these two, so they are a choice of the rule.

A rule with a wildcard, such as `Bash(rm -rf /tmp/*)`, also approves other targets, so the rule does not report it. The
rule does not model a target that holds a command substitution or another variable.

The rule reads the last of two keys of one name, as `JSON.parse` does. It reads the `allow` list only. It skips a string
that does not parse. [`permissions-rule-syntax`](permissions-rule-syntax.md) reports it.

### One report for one fault

- `Write(.claude/**)` and `NotebookEdit(...)` rules are for [`permissions-path-rule-tool`](permissions-path-rule-tool.md).
  Claude Code never consults a path rule for those tools. This rule reads `Edit` rules only.
- A path rule in `deny` or `ask` is not an allow rule. This rule does not read it. A `param:value` specifier names no protected path.
- [`permissions-bypass-mode-committed`](permissions-bypass-mode-committed.md) reports the mode in which protected-path writes
  are allowed.
- An `allowWrite` entry for a path outside the project, such as `~/.bashrc`, is for the planned heuristic rule
  `sandbox-allow-write-escalation`. This rule does not read it.

Fail:

```json
{
  "permissions": { "allow": ["Edit(.claude/**)", "Bash(rm -rf ~)"] },
  "sandbox": { "filesystem": { "allowWrite": [".git/hooks"] } }
}
```

Pass:

```json
{
  "permissions": { "allow": ["Edit(docs/**)", "Bash(rm -rf build)"] },
  "sandbox": { "filesystem": { "allowWrite": ["build"] } }
}
```

## Options

None.

## Sources

[^protected]: [Choose a permission mode: Protected paths](https://code.claude.com/docs/en/permission-modes#protected-paths)
[^critical]: [Choose a permission mode: Critical paths](https://code.claude.com/docs/en/permission-modes#critical-paths)
[^sandbox]: [Configure the sandboxed Bash tool: Protected paths](https://code.claude.com/docs/en/sandboxing#protected-paths)
[^allowwrite]: [All settings: sandbox.filesystem.allowWrite](https://code.claude.com/docs/en/settings-reference#sandboxfilesystemallowwrite)
