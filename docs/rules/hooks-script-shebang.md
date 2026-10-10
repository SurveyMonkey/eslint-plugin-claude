---
type: Reference
description: The ESLint rule claude/hooks-script-shebang, which reports a repository script that a hook runs directly and that does not start with a #! line.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-script-shebang`

Start a hook script that runs directly with a shebang line.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

The hooks guide shows its example hook script with a `#!/bin/bash` first line, and says that hook scripts must be
executable.[^guide] A script that a hook runs directly has no program to read it, so the system needs a shebang
line to pick the interpreter. The docs do not state this as a rule. The rule is a practice check from the
example of the guide.

The rule reads a command hook and finds each script that it runs directly. A script is the command word of a
shell-form `command`, or the `command` of an exec-form handler, when the path starts with `${CLAUDE_PROJECT_DIR}`
or `${CLAUDE_PLUGIN_ROOT}`, with braces or without. Then it reads the file. It reports at the `command` string when the file does not
start with `#!`.

The folders follow the place of the hook file:

| File | `${CLAUDE_PROJECT_DIR}` | `${CLAUDE_PLUGIN_ROOT}` |
|------|-------------------------|-------------------------|
| `.claude/settings.json`, `.claude/settings.local.json`, a skill or a subagent under `.claude/` | The folder above `.claude/` | Not resolved |
| `hooks/hooks.json` of a plugin | Not resolved | The plugin root |
| A managed file | Not resolved | Not resolved |

### What the rule does not read

- A path that starts in the working directory, such as `./hooks/a.sh`. The working directory is not in the file.
- A script that an interpreter runs, such as `bash a.sh` or `node a.js`. The interpreter needs no shebang.
- A handler with `shell` set to `"powershell"`, and a file that ends in `.ps1`, `.bat` or `.cmd`.
- A file that holds a null byte, because it is a program and not a script.
- A file that the rule cannot read inside the repository: a missing file, a folder, a FIFO, a link with no
  target, a link that leads out of the repository, a file that is not readable, and a file of more than one
  megabyte (ADR 001, Decision 14).

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, and no plugin agent.

Fail, in `.claude/settings.json`, when `.claude/hooks/check.sh` has no `#!` line:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/check.sh" }]
      }
    ]
  }
}
```

Pass: the same hook, when `.claude/hooks/check.sh` starts with `#!/bin/bash`.

## Sources

[^guide]: [Hooks guide: Block edits to protected files](https://code.claude.com/docs/en/hooks-guide#block-edits-to-protected-files)
