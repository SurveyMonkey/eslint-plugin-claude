---
type: Reference
description: The ESLint rule claude/permissions-sandbox-bash-ask, which reports a bare Bash ask rule or Bash(*) while sandbox.enabled is true and autoAllowBashIfSandboxed is true, because Claude Code skips the rule for a command that runs in the sandbox.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# claude/permissions-sandbox-bash-ask

📝 Do not rely on a bare Bash ask rule while the sandbox auto-allows Bash.

💼 This rule is enabled in the following configs: ✅ `recommended`, 🔒 `strict`.

<!-- end auto-generated rule header -->

| Category | Files                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------ |
| no-op    | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule skips a hidden drop-in in `managed-settings.d`, because Claude Code ignores it.

## Rule details

Assume `sandbox.enabled` is `true` and `autoAllowBashIfSandboxed` is `true`. Then Claude Code runs a sandboxed Bash
command with no prompt. This holds although the permissions hold a bare `Bash` ask rule or the same rule as `Bash(*)`. The
sandbox boundary replaces the prompt for the whole tool.[^interact][^auto] So the ask rule does not prompt for a sandboxed command.

The default of `autoAllowBashIfSandboxed` is `false`. The docs say: "Before v2.1.324, the default was `true`".[^auto]
So the rule reports only when a file of the same source sets the key to `true`. With the option `minVersion` older than
2.1.324, an unset key counts as `true` too. Claude Code before v2.1.324 turns the key on by default.

The rule reports each ask entry that is `Bash` or `Bash(*)`. The report is on the entry. To keep the prompt, set
`autoAllowBashIfSandboxed` to `false`, or write a scoped ask rule such as `Bash(git push *)`, which still prompts.

The rule is silent in these cases:

- `sandbox.enabled` is not `true`, or a file of the same source sets it to `false`.
- A file of the same source sets `autoAllowBashIfSandboxed` to `false`.
- No file of the same source sets `autoAllowBashIfSandboxed` to `true`, and `minVersion` is unset or is 2.1.324 or later.
- The ask rule has a specifier other than `*`, or the rule is for another tool.
- The rule cannot read a file of the same source.

### What the rule does not check

Claude Code still applies the ask rule in a few cases. The rule reports the entry in these cases too:

- In plan mode, Claude Code does not skip the ask rule.
- A command that runs outside the sandbox, such as an excluded command, still prompts.
- `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` turns auto-allow off.

The rule does not read `permissions.defaultMode`, `excludedCommands` or the `env` block.
It reads a quoted `"true"` in `sandbox.enabled` as no value. A user file or the `--settings` flag can set
`sandbox.enabled` or `autoAllowBashIfSandboxed`, and the repository does not hold them.

### One source

The rule adds up the files of one source. For a project file, the source is the pair `.claude/settings.json` and
`.claude/settings.local.json`. For a managed file, the source is `managed-settings.json` with the files of
`managed-settings.d/`. The rule never reads across the two. A file that the rule cannot read adds nothing to what a value proves.

The rule cannot show that `autoAllowBashIfSandboxed` is not `false` without that file. So it makes no report.

In a project or local file, the rule reads only the Boolean `true` as `true`. A quoted `"true"` is no value there, and
`sandbox-schema` reports it. In a managed file, Claude Code reads a quoted `"true"` or `"false"` as that Boolean. Another value
of `autoAllowBashIfSandboxed` counts as `false` there. See [`sandbox-schema`](sandbox-schema.md#a-managed-file).

Fail, in `.claude/settings.json`:

```json
{
  "permissions": { "ask": ["Bash"] },
  "sandbox": { "enabled": true, "autoAllowBashIfSandboxed": true }
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

<!-- begin auto-generated rule options list -->

| Name         | Description                                                                  | Type   |
| :----------- | :--------------------------------------------------------------------------- | :----- |
| `minVersion` | The oldest Claude Code version that the team supports, as major.minor.patch. | String |

<!-- end auto-generated rule options list -->

```js
'claude/permissions-sandbox-bash-ask': ['error', { minVersion: '2.1.300' }]
```

Without a `minVersion` older than 2.1.324, the rule needs a file that sets `autoAllowBashIfSandboxed` to `true`. The
docs give the default as `false` and say "Before v2.1.324, the default was `true`".[^auto] When `minVersion` is older
than 2.1.324, the rule also reports an unset key. The value has three numbers, such as `2.1.324`.

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/permissions-sandbox-bash-ask': 'error'
```

## Sources

[^interact]: [Configure permissions: How permissions interact with sandboxing](https://code.claude.com/docs/en/permissions#how-permissions-interact-with-sandboxing)
[^auto]: [All settings: sandbox.autoAllowBashIfSandboxed](https://code.claude.com/docs/en/settings-reference#sandbox-autoallowbashifsandboxed)
