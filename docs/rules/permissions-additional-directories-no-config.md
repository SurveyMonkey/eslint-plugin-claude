---
type: Reference
description: The ESLint rule claude/permissions-additional-directories-no-config, a heuristic that reports a permissions.additionalDirectories entry that names a directory of the repository with CLAUDE.md, rules, skills, commands or agents, because Claude Code loads none of that configuration from a directory that a settings file lists.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# `permissions-additional-directories-no-config`

Do not list a directory with Claude configuration in `additionalDirectories`, which loads none of it.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

The rule is `off` in `recommended`. It is a heuristic, so `strict` turns it on at `warn`.

## Rule details

A directory in `additionalDirectories` grants file access only. The docs say that these directories "don't load any of the
configuration" that a directory added with `--add-dir` can load.[^config] The environment variable
`CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD` "has no effect on directories listed in the `additionalDirectories` setting".[^grant]
So `CLAUDE.md`, `.claude/rules/`, skills, commands and agents in such a directory stay unused.

The rule reads each string entry. It reports an entry whose directory, inside the repository, holds one of these:

- `CLAUDE.md`, `CLAUDE.local.md` or `.claude/CLAUDE.md`
- `.claude/rules/`
- `.claude/skills/`, `.claude/commands/` or `.claude/agents/`

The settings files of such a directory are not in the list. A directory added with `--add-dir` loads two keys of them only, so
the advice of the message would not fit.[^config]

The message gives the way to load the files. A directory added with `--add-dir` loads skills, commands and agents. It loads
`CLAUDE.md` and rules only with `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1`.[^grant] Starting Claude Code in that directory
loads all of it.

### Where a relative entry starts

A relative entry resolves against the directory where Claude starts.[^grant] For `.claude/settings.json`, Claude Code reads the
project settings of the start directory with no parent fallback, so the rule resolves the entry from the directory that holds
`.claude/`. The local file loads from the repository root whatever the start directory, so the rule reads absolute entries only in
`settings.local.json`. A managed file applies to every project on a machine, so the rule does not check it.

### Silent cases

The rule makes no report for these entries:

- A path that is not in the repository, an entry that is not a string, and an entry with a NUL byte. A home path (`~/x`)
  and a variable (`$HOME/x`) are not read: the rule takes each as a name below the project.
- A directory that is not there, an entry that is a file, and a link with no target.
- A directory that the rule cannot read, or whose `CLAUDE.md` or `.claude` is a link that leaves the repository (ADR 001,
  Decision 14).
- The project directory, a directory above it and a directory below it. Claude Code loads their configuration as part of the
  project, and loads a `CLAUDE.md` below the project on demand.

Fail, in `packages/api/.claude/settings.json`, when `packages/shared/CLAUDE.md` exists:

```json
{ "permissions": { "additionalDirectories": ["../shared"] } }
```

Pass:

```json
{ "permissions": { "additionalDirectories": ["../docs"] } }
```

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/permissions-additional-directories-no-config': 'warn'
```

## Options

None.

## Sources

[^config]: [Configure permissions: Additional directories grant file access, not configuration](https://code.claude.com/docs/en/permissions#additional-directories-grant-file-access-not-configuration)
[^grant]: [Set up Claude Code in a monorepo or large codebase: Grant access across packages or repositories](https://code.claude.com/docs/en/large-codebases#grant-access-across-packages-or-repositories)
