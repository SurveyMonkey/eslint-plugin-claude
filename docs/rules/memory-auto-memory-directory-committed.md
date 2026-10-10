---
type: Reference
description: The ESLint rule claude/memory-auto-memory-directory-committed, which reports an autoMemoryDirectory key in .claude/settings.json or .claude/settings.local.json, because the value is repository-supplied, needs workspace trust, and is ignored while permissions.blockReadsOutsideWorkingDirectories is on.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `memory-auto-memory-directory-committed`

Do not set `autoMemoryDirectory` in a project settings file.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | security | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

## Rule details

The key `autoMemoryDirectory` moves the folder of auto memory. Claude Code reads it from any
settings scope: user, project, local, policy, or `--settings`.[^storage] A path in a project file
comes from the repository, so Claude Code treats it with care:

- It honors the value in `.claude/settings.json` or `.claude/settings.local.json` under the same
  workspace trust rule as hooks in settings files.[^storage]
- The key `permissions.blockReadsOutsideWorkingDirectories` can be on. Then Claude Code loads no auto memory from a directory that a repository-supplied file chooses. It saves none to it.[^storage]
- The value must be an absolute path or start with `~/`.[^directory] A path in a committed file
  holds one user's home directory, so it fits no teammate.

The rule reports the `autoMemoryDirectory` member in the project file and in the local file, at the
member. The message names the file. A value of `null` reads as unset, so the rule makes no report
for it. The rule reports a value of any other type: `memory-settings-schema` reports the type, and
this rule reports that the key is set.

Fail, in `.claude/settings.json`:

```json
{
  "autoMemoryDirectory": "~/team-memory"
}
```

Pass: set the key in your user settings, `~/.claude/settings.json`, and leave it out of the project
files.

The rule lints the two project files. A managed settings file is policy, and not repository-supplied input. So the rule does not lint `managed-settings.json` or a file in `managed-settings.d/`. The
local file is usually in `.gitignore`. The rule still lints it, because the key has the same trust
rule there. A team that keeps the file out of Git can turn the rule off for it.

## Sources

[^storage]: [How Claude remembers your project: Storage location](https://code.claude.com/docs/en/memory#storage-location)
[^directory]: [All settings: autoMemoryDirectory](https://code.claude.com/docs/en/settings-reference#automemorydirectory)
