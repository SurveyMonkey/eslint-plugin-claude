---
type: Reference
description: The ESLint rule claude/permissions-path-anchor, which reports a Read, Edit or Cd rule that starts with one slash and a file system root such as /Users, and a sandbox filesystem path in a project file that starts with one slash and is no root, because the single slash does not mean what the person expects.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-path-anchor`

Anchor an absolute path rule with `//`, and a project sandbox path with `./`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule is `off` in `recommended`. It is a heuristic, so `strict` turns it on at `warn`.
The rule also lints the managed settings files: `managed-settings.json` and each `managed-settings.d/*.json` drop-in.
It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

In a `Read`, `Edit` or `Cd` rule, a single leading slash anchors at the settings source, not at the file system root.[^read] The docs
say: "A pattern like `/Users/alice/file` isn't an absolute path." The pattern for an absolute path starts with `//`.[^read]
The rule reports a rule in any list whose path starts with one slash and a first segment from a short list of root directories
(`Users`, `home`, `tmp`, `var`, `etc`, `opt`, `usr`, `mnt`, `Volumes`, `private`, `Library`, `Applications`, `root`, `srv`, `nix`).
`Edit(/src/**)` is silent: a project directory is a valid use. The list is a choice of the plugin, in `src/data/bash-commands.ts`.
The message gives the rule with two slashes.

A sandbox path in `allowWrite`, `denyWrite`, `denyRead` or `allowRead` works the other way. A single slash is an absolute path
there.[^prefixes] The docs say: "If you use single-slash `/path` expecting project-relative resolution, switch to `./path`."[^prefixes]
The rule reports such a path in a project or local file when the first segment is not in the list of roots. `/tmp/build` is
silent. `/output` gets a report, with the advice to write `./output` for the project root. A person who means the
file system root keeps the path. The rule checks the four lists below `sandbox.filesystem`.

### What the rule does not check

The row has two more parts. Both rest on user settings: a `/path` rule in `~/.claude/settings.json` resolves under `~/.claude`, and a
sandbox `.` or `./` path there resolves under `~/.claude`.[^read][^prefixes] A user file is outside the repository, and the plugin
does not read it (ADR 001, Decision 14). The rule does not check them.

The docs give a single slash no project meaning in a managed file, so the sandbox part is silent there. The permission part
reads managed files, because the warning of the docs holds for every source.[^read]

Fail:

```json
{
  "permissions": { "deny": ["Read(/Users/me/secrets/**)"] },
  "sandbox": { "filesystem": { "allowWrite": ["/output"] } }
}
```

Pass:

```json
{
  "permissions": { "deny": ["Read(//Users/me/secrets/**)"] },
  "sandbox": { "filesystem": { "allowWrite": ["./output"] } }
}
```

## Options

None.

## Sources

[^read]: [Configure permissions: Read and Edit](https://code.claude.com/docs/en/permissions#read-and-edit)
[^prefixes]: [All settings: Sandbox path prefixes](https://code.claude.com/docs/en/settings-reference#sandbox-path-prefixes)
