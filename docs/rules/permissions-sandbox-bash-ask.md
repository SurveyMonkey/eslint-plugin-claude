---
type: Reference
description: The ESLint rule claude/permissions-sandbox-bash-ask, which reports a bare Bash ask rule or Bash(*) while sandbox.enabled is true and autoAllowBashIfSandboxed is not false, because Claude Code skips the rule for a command that runs in the sandbox.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-sandbox-bash-ask`

Do not rely on a bare `Bash` ask rule while the sandbox runs Bash commands without a prompt.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule skips a hidden drop-in in `managed-settings.d`, because Claude Code ignores it.

## Rule details

When `sandbox.enabled` is `true` and `autoAllowBashIfSandboxed` keeps its default of `true`, Claude Code runs a sandboxed Bash
command with no prompt. This holds although the permissions hold a bare `Bash` ask rule or the same rule as `Bash(*)`. The
sandbox boundary replaces the prompt for the whole tool.[^interact][^auto] So the ask rule does not prompt for a sandboxed command.

The rule reports each ask entry that is `Bash` or `Bash(*)`. The report is on the entry. To keep the prompt, set
`autoAllowBashIfSandboxed` to `false`, or write a scoped ask rule such as `Bash(git push *)`, which still prompts.

The rule is silent in these cases:

- `sandbox.enabled` is not `true`, or a file of the same source sets it to `false`.
- A file of the same source sets `autoAllowBashIfSandboxed` to `false`.
- The ask rule has a specifier other than `*`, or the rule is for another tool.
- The rule cannot read a file of the same source.

### What the rule does not check

Claude Code still applies the ask rule in a few cases, and the rule reports the entry in these cases too:

- In plan mode, Claude Code does not skip the ask rule.
- A command that runs outside the sandbox, such as an excluded command, still prompts.
- `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` turns auto-allow off.

The rule does not read `permissions.defaultMode`, `excludedCommands` or the `env` block.
It reads a quoted `"true"` in `sandbox.enabled` as no value. A user file or the `--settings` flag can set
`sandbox.enabled` or `autoAllowBashIfSandboxed`, and the repository does not hold them.

### One source

The rule adds up the files of one source. For a project file, the source is the pair `.claude/settings.json` and
`.claude/settings.local.json`. For a managed file, the source is `managed-settings.json` with the files of
`managed-settings.d/`. The rule never reads across the two. A file that the rule cannot read adds nothing to what a value proves. The rule cannot show that `autoAllowBashIfSandboxed` is not `false` without that file. So it makes no report.

Fail, in `.claude/settings.json`:

```json
{
  "permissions": { "ask": ["Bash"] },
  "sandbox": { "enabled": true }
}
```

Pass, in `.claude/settings.json`:

```json
{
  "permissions": { "ask": ["Bash"] },
  "sandbox": { "enabled": true, "autoAllowBashIfSandboxed": false }
}
```

## Options

None.

## Sources

[^interact]: [Configure permissions: How permissions interact with sandboxing](https://code.claude.com/docs/en/permissions#how-permissions-interact-with-sandboxing)
[^auto]: [All settings: sandbox.autoAllowBashIfSandboxed](https://code.claude.com/docs/en/settings-reference#sandbox-autoallowbashifsandboxed)
