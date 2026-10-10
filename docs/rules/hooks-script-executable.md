---
type: Reference
description: The ESLint rule claude/hooks-script-executable, which reports a repository script that is itself the hook command when its git index mode is 100644 and not 100755, because Claude Code cannot run it.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-script-executable`

Give a hook script the executable bit.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/hooks/hooks.json`, `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

A hook script must be executable for Claude Code to run it.[^guide] On macOS and Linux, a script
without the bit makes the hook fail instead of blocking anything.[^subagent] A plugin hook script
needs the bit too.[^plugin]

The rule reads each command hook, and finds the program: the first word of `command` in the shell
form, or `command` itself in the exec form. When the program is a repository script, the rule checks
its mode. A script is a repository script when its path starts with `${CLAUDE_PROJECT_DIR}` or
`${CLAUDE_PLUGIN_ROOT}`, or is a path from the project. Where each variable resolves is the same as
in [`hooks-script-exists`](hooks-script-exists.md).

The executable bit is the git index mode. The rule reads it with `git ls-files --stage`, and
reports mode `100644`. It does not read the mode on the disk, for two reasons:

- The index can keep `100755` while the disk shows `644`. The team gets the index mode when it
  clones the repository.
- With `core.fileMode=false`, git does not see the disk mode. The index mode is then the only
  mode that the repository records.

The rule makes no report in these cases:

- **The script is an argument.** `node ${CLAUDE_PROJECT_DIR}/run.js` and
  `bash ${CLAUDE_PROJECT_DIR}/run.sh` run `node` and `bash`. They need no bit on the script. A
  script after the first word, as in `a && ./run.sh`, is not the program either.
- **Git does not track the script.** A new file that is not staged has no index mode. A script
  that is not there is for `hooks-script-exists`.
- **The rule cannot read the index.** There is no `.git` entry at or above the file, `git` is not
  installed, or a `git` command fails.
- **The path is out of the repository**, or a link hides it (ADR 001, Decision 14). A link to a
  file in the repository takes the mode of that file.
- **The command is not a repository path.** A bare name, an absolute path, a path in `~`, a glob,
  and a word with another variable are not read.
- **The file is a hidden drop-in** in `managed-settings.d/`, which Claude Code ignores, or a
  `hooks/hooks.json` that is in no plugin.

On Windows, the hook does not need the bit. The rule does not know the platform of the reader, so
it reports there too.

Fail:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/check.sh" }
        ]
      }
    ]
  }
}
```

in `.claude/settings.json`, when git tracks `.claude/hooks/check.sh` with mode `100644`.

Pass: the same file, with `git update-index --chmod=+x .claude/hooks/check.sh`.

## Options

None.

## Sources

[^guide]: [Automate actions with hooks: Block edits to protected files](https://code.claude.com/docs/en/hooks-guide#block-edits-to-protected-files)
[^subagent]: [Create custom subagents: Conditional rules with hooks](https://code.claude.com/docs/en/sub-agents#conditional-rules-with-hooks)
[^plugin]: [Add components to a plugin: Hooks](https://code.claude.com/docs/en/plugins/components#hooks)
