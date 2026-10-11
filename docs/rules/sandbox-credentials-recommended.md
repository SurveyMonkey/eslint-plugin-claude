---
type: Reference
description: The ESLint rule claude/sandbox-credentials-recommended, a heuristic that reports a settings file that turns the sandbox on when its source has no denyRead path, credentials entry or Read deny rule for ~/.aws or ~/.ssh, because the default read policy lets sandboxed commands read credential files.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# `sandbox-credentials-recommended`

Deny sandboxed commands the credential directories `~/.aws` and `~/.ssh`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | security | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule is `off` in `recommended`. It is a heuristic, so `strict` turns it on at `warn`.

## Rule details

By default a sandboxed command can read the whole computer, credential files included. Claude Code has no built-in credential
deny list, so it protects only the files that a source lists.[^denyread][^credentials] The managed settings advice is to "add
`sandbox.credentials` entries for credential directories such as `~/.aws` and `~/.ssh`".[^enforce]

The rule reports a file that sets `sandbox.enabled` to `true` when its source keeps neither directory unreadable. The report is
on the `enabled` value of the file, and names the directories that are open. The other file of the pair does not report.
These count as protection of a directory:

- a `sandbox.filesystem.denyRead` path[^denyread]
- a `sandbox.credentials.files` entry with `"mode": "deny"`, or with `"mode": "mask"` in a managed file[^credentials]
- a `Read` deny rule that starts with `~` or `//`, because Claude Code adds those rules to `denyRead`[^filesystem]

Claude Code drops a `mask` entry from the two project files, so a `mask` entry there protects nothing.[^credentials]

A path protects a directory when it is the directory or a path in it. A path also protects it when it is the home directory
or the root above it. The docs example `"denyRead": ["~/"]` protects both. A `Read` rule with no specifier protects both.
`~/.aws/credentials` protects `~/.aws`.

A path with no prefix, or with `./`, is relative to the project root in a project file.[^prefixes] So `./.aws` and `.ssh`
protect nothing in the home directory. In a `Read` rule, a single `/path` is relative to the project, so only `~` and `//`
forms count. The rule does not read `allowRead`, which can open a part of a denied path again.[^fs-isolation]

### What the rule does not read

- A user settings file. It is outside the repository (ADR 001, Decision 14), and a user `denyRead` or `credentials` entry
  applies to every project.[^credentials] The rule is `off` in `recommended` for that reason.
- A source with a file that the rule cannot read. That file can hold the entries, so the rule gives no report.
- A managed source with `filesystem.disabled` on. Claude Code then does not enforce `denyRead` or `credentials.files` `deny`
  entries.[^credentials] Claude Code ignores `disabled` in a project file, so the rule still reports there.
  `sandbox-filesystem-disabled-conflict` and `sandbox-weakening-options` own that value.
- A source with `permissions.blockReadsOutsideWorkingDirectories` on. The docs say sandboxed commands then lose read access to
  the home directory, with the exceptions that the docs list.[^fs-isolation]

### Docs examples

The `sandbox` example of the settings reference denies `~/.aws/credentials` only, so the rule reports it for `~/.ssh`. The
credentials example of the sandboxing page names both directories, and the rule is silent for it.[^protect]

Fail:

```json
{ "sandbox": { "enabled": true } }
```

Pass:

```json
{
  "sandbox": {
    "enabled": true,
    "credentials": {
      "files": [
        { "path": "~/.aws/credentials", "mode": "deny" },
        { "path": "~/.ssh", "mode": "deny" }
      ]
    }
  }
}
```

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/sandbox-credentials-recommended': 'warn'
```

## Options

None.

## Sources

[^denyread]: [All settings: sandbox.filesystem.denyRead](https://code.claude.com/docs/en/settings-reference#sandbox-filesystem-denyread)
[^credentials]: [All settings: sandbox.credentials](https://code.claude.com/docs/en/settings-reference#sandbox-credentials)
[^filesystem]: [All settings: sandbox.filesystem](https://code.claude.com/docs/en/settings-reference#sandbox-filesystem)
[^enforce]: [Configure the sandboxed Bash tool: Enforce sandboxing with managed settings](https://code.claude.com/docs/en/sandboxing#enforce-sandboxing-with-managed-settings)
[^prefixes]: [All settings: Sandbox path prefixes](https://code.claude.com/docs/en/settings-reference#sandbox-path-prefixes)
[^protect]: [Configure the sandboxed Bash tool: Protect credentials](https://code.claude.com/docs/en/sandboxing#protect-credentials)
[^fs-isolation]: [Configure the sandboxed Bash tool: Filesystem isolation](https://code.claude.com/docs/en/sandboxing#filesystem-isolation)
